import { createServer } from 'node:http';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { isIP, Socket } from 'node:net';
import path from 'node:path';
import { readFile, rm } from 'node:fs/promises';
import { createProxyServer } from 'http-proxy-3';
import { DeviceStore, AttemptLimiter } from './auth-store.mjs';
import { atomicJson, loadPrivateState, protectStateDirectory } from './state.mjs';
import { acquireInstanceLease } from './instance-lease.mjs';
import { pairPage } from './pair-page.mjs';

const cookieValue = (request, name) => {
  const entries = (request.headers.cookie || '').split(';').map(value => value.trim()).filter(value => value.startsWith(name + '='));
  return entries.length === 1 ? entries[0].slice(name.length + 1) : undefined;
};
const sameSecret = (left, right) => typeof left === 'string' && timingSafeEqual(createHash('sha256').update(left).digest(), createHash('sha256').update(right).digest());
const respond = (response, status, value) => { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); response.end(JSON.stringify(value)); };
async function jsonBody(request) {
  const parts = []; let size = 0;
  for await (const part of request) { size += part.length; if (size > 4096) throw new Error('request-too-large'); parts.push(part); }
  const value = JSON.parse(Buffer.concat(parts).toString('utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-request');
  return value;
}
const listen = server => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.removeListener('error', reject); resolve(`http://127.0.0.1:${server.address().port}`); }); });
const closeServer = server => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });

export async function createGateway(options) {
  await protectStateDirectory(options.stateDirectory);
  const lease = await acquireInstanceLease(options.stateDirectory);
  try { return await createLeasedGateway(options, lease); }
  catch (error) { await lease.close(); throw error; }
}

async function createLeasedGateway(options, lease) {
  let publicUrl = new URL(options.publicOrigin);
  const testHttp = options.allowLoopbackHttp === true && publicUrl.protocol === 'http:' && publicUrl.hostname === '127.0.0.1';
  if ((!testHttp && (publicUrl.protocol !== 'https:' || !isIP(publicUrl.hostname))) || publicUrl.username || publicUrl.password || publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) throw new Error('Use an HTTPS IP origin; HTTP is restricted to explicit loopback tests');
  const secure = !testHttp;
  const cookieName = secure ? '__Host-dsh_remote' : 'dsh_remote_dev';
  const devices = new DeviceStore(options.stateDirectory);
  await devices.load();
  const limiter = new AttemptLimiter();
  const live = new Map();
  const lastSeen = new Map();
  const connected = id => [...(live.get(id) || [])].some(stream => stream instanceof Socket && !stream.destroyed);
  const controlToken = randomBytes(32).toString('base64url');
  const instanceId = randomUUID();
  let cachedHost, hostFlight, closing;
  const proxy = createProxyServer({ ws: true, xfwd: false, changeOrigin: false, proxyTimeout: 0, timeout: 0 });
  proxy.on('error', () => {});
  proxy.on('proxyRes', response => {
    if(response.statusCode===401)cachedHost=undefined;
    delete response.headers['set-cookie'];
    response.headers['referrer-policy'] = 'no-referrer';
    response.headers['x-content-type-options'] = 'nosniff';
    const location = response.headers.location;
    if (location && cachedHost && location.startsWith(cachedHost.origin + '/')) response.headers.location = publicUrl.origin + location.slice(cachedHost.origin.length);
  });

  async function upstream() {
    const descriptor = await loadPrivateState(options.instanceStateDirectory);
    if (cachedHost?.instanceId === descriptor.instanceId) return cachedHost;
    if (hostFlight) return await hostFlight;
    hostFlight = (async () => {
      const response = await fetch(descriptor.launchUrl, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      await response.body?.cancel();
      const target = new URL(response.headers.get('location') || '', descriptor.origin);
      if (![302,303].includes(response.status) || target.origin !== descriptor.origin || target.pathname !== '/' || target.search || target.hash) throw new Error('host-bootstrap-failed');
      const cookie = response.headers.getSetCookie().map(value => value.split(';',1)[0]).join('; ');
      if (!cookie) throw new Error('host-bootstrap-failed');
      cachedHost = { origin: descriptor.origin, instanceId: descriptor.instanceId, hostPid: descriptor.hostPid, cookie };
      return cachedHost;
    })();
    try { return await hostFlight; } finally { hostFlight = undefined; }
  }
  function track(id, stream) {
    const streams = live.get(id) || new Set(); live.set(id, streams); streams.add(stream);
    const release = () => { streams.delete(stream); if (!streams.size) live.delete(id); };
    stream.once('close', release); stream.once('finish', release);
  }
  async function revoke(id) { await devices.revoke(id); for (const stream of live.get(id) || []) stream.destroy(); live.delete(id); lastSeen.delete(id); }
  const validHost = request => request.headers.host?.toLowerCase() === publicUrl.host.toLowerCase();
  const validOrigin = request => request.headers.origin === publicUrl.origin && request.headers['sec-fetch-site'] !== 'cross-site';
  const blocked = pathname => {
    let decoded;
    try { decoded = decodeURIComponent(pathname).replaceAll('\\', '/'); } catch { return true; }
    return [pathname, decoded].some(value => value === '/connect' || value.startsWith('/inspector') || value.startsWith('/api/dsh-remote-aliyun-probe') || value.startsWith('/__dsh-remote-admin'));
  };
  function normalize(request, host) {
    for (const name of Object.keys(request.headers)) if (/^(?:forwarded|x-forwarded-|x-real-ip|authorization|cookie|host|origin|sec-fetch-)/.test(name)) delete request.headers[name];
    request.headers.host = new URL(host.origin).host;
    request.headers.origin = host.origin;
    request.headers.cookie = host.cookie;
  }

  const server = createServer((request, response) => { void (async () => {
    if (!validHost(request)) return respond(response, 421, { error:'wrong-host' });
    const url = new URL(request.url || '/', 'http://gateway.invalid');
    if (url.origin !== 'http://gateway.invalid' || url.searchParams.has('token') || blocked(url.pathname)) return respond(response,403,{error:'forbidden'});
    if (url.pathname === '/healthz' && request.method === 'GET') return respond(response,200,{service:'dsh-remote-gateway',online:true});
    if (url.pathname === '/pair' && request.method === 'GET') {
      const nonce = randomBytes(18).toString('base64url');
      response.writeHead(200, { 'content-type':'text/html; charset=utf-8', 'cache-control':'no-store', 'referrer-policy':'no-referrer', 'content-security-policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'` });
      response.end(pairPage(nonce)); return;
    }
    if (url.pathname === '/pair/claim' && request.method === 'POST') {
      if (!validOrigin(request)) return respond(response,403,{error:'wrong-origin'});
      if (!limiter.allow()) return respond(response,429,{error:'rate-limited'});
      const body = await jsonBody(request);
      const result = await devices.claim(body.credential, body.label, cookieValue(request,cookieName));
      if (!result) return respond(response,401,{error:'invalid-pairing'});
      response.setHeader('set-cookie', `${cookieName}=${result.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${secure?'; Secure':''}`);
      return respond(response,200,{paired:true,device:result.device});
    }
    const rawToken = cookieValue(request,cookieName), device = devices.authenticate(rawToken);
    if (!device) {
      if (url.pathname === '/' && request.method === 'GET') { response.writeHead(303,{location:'/pair','cache-control':'no-store'}); response.end(); return; }
      return respond(response,401,{error:'pairing-required'});
    }
    if ((!['GET','HEAD','OPTIONS'].includes(request.method) || request.headers.origin !== undefined || request.headers['sec-fetch-site'] === 'cross-site') && !validOrigin(request)) return respond(response,403,{error:'wrong-origin'});
    lastSeen.set(device.id, Date.now());
    // Device-scoped operations: no link or local management credential is exposed.
    if (url.pathname === '/remote/access' && request.method === 'GET') return respond(response,200,{authorized:true,device,transport:options.transportStatus?.()?.phase || 'ready'});
    if (url.pathname === '/remote/logout' && request.method === 'POST') {
      await revoke(device.id);
      response.setHeader('set-cookie',`${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?'; Secure':''}`);
      return respond(response,200,{disconnected:true});
    }
    const host = await upstream();
    if (!devices.authenticate(rawToken)) return respond(response,401,{error:'device-revoked'});
    request.url = url.pathname + url.search;
    normalize(request,host); track(device.id,response);
    proxy.web(request,response,{target:host.origin},() => { cachedHost=undefined; if(!response.headersSent)respond(response,503,{error:'desktop-unavailable'});else response.destroy(); });
  })().catch(error => { if (!response.headersSent) respond(response,error.message==='request-too-large'?413:503,{error:'request-unavailable'}); else response.destroy(); }); });

  server.on('upgrade',(request,socket,head) => { void (async () => {
    const url = new URL(request.url || '/', 'http://gateway.invalid');
    const rawToken = cookieValue(request,cookieName), device=devices.authenticate(rawToken);
    if (!validHost(request) || !validOrigin(request) || !device || url.origin!=='http://gateway.invalid' || blocked(url.pathname) || url.searchParams.has('token')) { socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return; }
    const host=await upstream();
    if(!devices.authenticate(rawToken)){socket.destroy();return;}
    lastSeen.set(device.id, Date.now());
    request.url=url.pathname+url.search;normalize(request,host);track(device.id,socket);
    proxy.ws(request,socket,head,{target:host.origin},()=>socket.destroy());
  })().catch(()=>socket.destroy()); });
  const gatewayOrigin = await listen(server);
  if (testHttp && publicUrl.port === '0') publicUrl = new URL(gatewayOrigin);
  let managementOrigin;
  // This listener is separate from the SSH-forwarded data server, binds only
  // 127.0.0.1, and requires the local private descriptor's 256-bit Bearer key.
  const management = createServer((request,response)=>{void(async()=>{
    if (request.socket.remoteAddress !== '127.0.0.1' || request.headers.host !== new URL(managementOrigin).host || (request.headers.origin && request.headers.origin !== managementOrigin) || !sameSecret(request.headers.authorization,`Bearer ${controlToken}`)) return respond(response,403,{error:'forbidden'});
    const pathname=new URL(request.url||'/','http://local.invalid').pathname;
    // Read-only refresh never creates or rotates a credential. Creation is the
    // separate authenticated POST used by the desktop's Generate Link button.
    if(request.method==='GET'&&pathname==='/__dsh-remote-admin/link')return respond(response,200,{link:devices.existingAccessLink()});
    // Both operations are unreachable through the public data listener, which
    // rejects /__dsh-remote-admin before device auth or upstream proxying.
    if(request.method==='POST'&&pathname==='/__dsh-remote-admin/link'){
      const link=await devices.accessLink();return respond(response,200,{...link,url:`${publicUrl.origin}/pair#${link.secret}`});
    }
    if(request.method==='POST'&&pathname==='/__dsh-remote-admin/reset-link'){
      const link=await devices.resetAccessLink();
      for(const streams of live.values())for(const stream of streams)stream.destroy();live.clear();lastSeen.clear();
      return respond(response,200,{...link,url:`${publicUrl.origin}/pair#${link.secret}`,revokedAllDevices:true});
    }
    if(request.method==='GET'&&pathname==='/status')return respond(response,200,{instanceId,protocolVersion:2,gatewayVersion:'0.5.1',publicOrigin:publicUrl.origin,gatewayOrigin,pairedDevices:devices.list().length,connectedDevices:devices.list().filter(device=>connected(device.id)).length,pairingAvailable:devices.pairingAvailable(),hostPid:cachedHost?.hostPid||null,transport:options.transportStatus?.()||null});
    if(request.method==='GET'&&pathname==='/devices')return respond(response,200,{devices:devices.list().map(device=>({...device,connected:connected(device.id),lastSeenAt:lastSeen.get(device.id)||null}))});
    if(request.method==='POST'&&pathname==='/pair'){const ticket=devices.issue();return respond(response,200,{...ticket,url:`${publicUrl.origin}/pair#${ticket.secret}`});}
    if(request.method==='POST'&&pathname==='/revoke'){const body=await jsonBody(request);if(typeof body.id!=='string')return respond(response,400,{error:'invalid-device'});await revoke(body.id);return respond(response,200,{revoked:true});}
    if(request.method==='POST'&&pathname==='/stop'){respond(response,200,{stopping:true});setImmediate(()=>void close());return;}
    respond(response,404,{error:'not-found'});
  })().catch(()=>respond(response,400,{error:'invalid-request'}));});
  try {
    managementOrigin=await listen(management);
    const descriptor={schemaVersion:1,instanceId,pid:process.pid,publicOrigin:publicUrl.origin,gatewayOrigin,managementOrigin,controlToken};
    await atomicJson(path.join(options.stateDirectory,'gateway.private.json'),descriptor);
  } catch (error) {
    proxy.close(); await Promise.all([closeServer(server),closeServer(management)]); throw error;
  }
  async function close(){
    closing??=(async()=>{
      devices.invalidateTicket();for(const streams of live.values())for(const stream of streams)stream.destroy();proxy.close();
      await Promise.all([closeServer(server),closeServer(management)]);await options.onClose?.();
      const file=path.join(options.stateDirectory,'gateway.private.json');
      try{if(JSON.parse(await readFile(file,'utf8')).instanceId===instanceId)await rm(file,{force:true});}catch(error){if(error.code!=='ENOENT')throw error;}
      finally { await lease.close(); }
    })();return await closing;
  }
  return { publicOrigin:publicUrl.origin,gatewayOrigin,managementOrigin,close };
}
