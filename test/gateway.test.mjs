import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import WebSocket, { WebSocketServer } from 'ws';
import { DeviceStore } from '../src/auth-store.mjs';
import { createGateway } from '../src/gateway.mjs';
import { publishState } from '../src/state.mjs';
import { sshArguments } from '../src/ssh-tunnel.mjs';
import {temporary as createTemporary} from './helpers.mjs';

const temporary=()=>createTemporary('gateway-test-');
const post=(url,body,headers={})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),redirect:'manual'});

test('single-use pairing is atomic, persists only hashes, survives restart and revokes',async()=>{
  const directory=await temporary();
  try{
    const store=new DeviceStore(directory);await store.load();const ticket=store.issue();
    const results=await Promise.all([store.claim(ticket.code,'test'),store.claim(ticket.secret,'replay')]);
    assert.equal(results.filter(Boolean).length,1);const claimed=results.find(Boolean);
    const persisted=await readFile(path.join(directory,'devices.json'),'utf8');
    assert.ok(!persisted.includes(claimed.token)&&!persisted.includes(ticket.secret)&&!persisted.includes(ticket.code));
    await writeFile(path.join(directory,'devices.json'),JSON.stringify({...JSON.parse(persisted),schemaVersion:1}));
    const restored=new DeviceStore(directory);await restored.load();assert.equal(restored.authenticate(claimed.token).id,claimed.device.id);
    await restored.accessLink();assert.equal(restored.authenticate(claimed.token).id,claimed.device.id,'adding a permanent link preserves legacy device authorization');
    await restored.revoke(claimed.device.id);assert.equal(restored.authenticate(claimed.token),undefined);
    await writeFile(path.join(directory,'devices.json'),'broken');await assert.rejects(new DeviceStore(directory).load(),/access remains closed/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('pairing expiration and SSH forwarding protect existing port 18080',async()=>{
  const directory=await temporary();
  try{
    let now=1000;const store=new DeviceStore(directory,()=>now);const ticket=store.issue();now+=300001;
    assert.equal(await store.claim(ticket.code),undefined);
    const config={destination:'root@203.0.113.10',identityFile:path.resolve(directory,'identity.pem'),remotePort:18181};
    const args=sshArguments(config,'http://127.0.0.1:45678',path.resolve(directory,'ssh.conf'));
    assert.ok(args.includes('127.0.0.1:18181:127.0.0.1:45678'));assert.ok(args.includes('StrictHostKeyChecking=yes'));
    assert.throws(()=>sshArguments({...config,remotePort:18080},'http://127.0.0.1:45678','test'),/reserved/);
    assert.throws(()=>sshArguments({...config,destination:'root@host;command'},'http://127.0.0.1:45678','test'),/Invalid SSH/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('persistent links survive years and reload; reset invalidates old links, devices and queued claims',async()=>{
  const directory=await temporary();
  try{
    let now=1000;const store=new DeviceStore(directory,()=>now);await store.load();
    assert.equal(store.existingAccessLink(),null);
    const link=await store.accessLink();assert.equal(link.expiresAt,null);
    const first=await store.claim(link.secret,'phone');
    assert.equal((await store.claim(link.secret,'same phone',first.token)).device.id,first.device.id);assert.equal(store.list().length,1);
    now+=3*365*24*60*60*1000;
    const restored=new DeviceStore(directory,()=>now);await restored.load();
    assert.equal(restored.authenticate(first.token),undefined,'device cookies expire independently of the persistent link');
    assert.equal((await restored.accessLink()).secret,link.secret);
    const second=await restored.claim(link.secret,'new phone');assert.ok(second);
    const reset=restored.resetAccessLink(),queuedClaim=restored.claim(link.secret,'old link racing reset');
    const replacement=await reset;assert.notEqual(replacement.secret,link.secret);assert.equal(await queuedClaim,undefined);
    assert.equal(restored.authenticate(second.token),undefined);assert.equal(restored.list().length,0);
    assert.ok(await restored.claim(replacement.secret,'authorized anew'));
  }finally{await rm(directory,{recursive:true,force:true});}
});

for (const desktopVersion of ['0.2.1-rc.2', '0.2.1-rc.3']) test(`gateway accepts Desktop ${desktopVersion}, enforces authentication and proxies HTTP/WS with revocation`,async()=>{
  const directory=await temporary(), instanceDirectory=path.join(directory,'instance');
  let gateway, core;
  const websocketServer=new WebSocketServer({noServer:true});
  let observedHeaders;
  try{
    core=createServer((request,response)=>{
      if(request.url==='/?token=fixture-bootstrap'){response.writeHead(303,{'set-cookie':'core_session=fixture-core-secret; HttpOnly; SameSite=Strict',location:'./'});response.end();return;}
      if(request.headers.cookie!=='core_session=fixture-core-secret'){response.writeHead(401);response.end();return;}
      observedHeaders=request.headers;
      if(request.url==='/'){response.writeHead(200,{'content-type':'text/html','set-cookie':'core_session=never-forward-this'});response.end('<html><script>window.__DSH_BOOT__={}</script></html>');return;}
      if(request.url==='/api/echo'){const chunks=[];request.on('data',chunk=>chunks.push(chunk));request.on('end',()=>response.end(Buffer.concat(chunks)));return;}
      response.writeHead(404);response.end();
    });
    core.on('upgrade',(request,socket,head)=>{
      if(request.headers.cookie!=='core_session=fixture-core-secret'){socket.destroy();return;}
      websocketServer.handleUpgrade(request,socket,head,ws=>ws.on('message',data=>ws.send(data)));
    });
    await new Promise(resolve=>core.listen(0,'127.0.0.1',resolve));const coreOrigin=`http://127.0.0.1:${core.address().port}`;
    await publishState(instanceDirectory,{schemaVersion:1,kind:'dsh-desktop-step1',profile:'desktop',version:desktopVersion,instanceId:randomUUID(),hostPid:process.pid,origin:coreOrigin,launchUrl:coreOrigin+'/?token=fixture-bootstrap'});
    gateway=await createGateway({stateDirectory:path.join(directory,'gateway'),instanceStateDirectory:instanceDirectory,publicOrigin:'http://127.0.0.1:0',allowLoopbackHttp:true});
    await assert.rejects(createGateway({stateDirectory:path.join(directory,'gateway'),instanceStateDirectory:instanceDirectory,publicOrigin:'http://127.0.0.1:0',allowLoopbackHttp:true}),/already owns/);
    const descriptor=JSON.parse(await readFile(path.join(directory,'gateway','gateway.private.json')));
    const management=(route,body)=>fetch(descriptor.managementOrigin+route,{method:body?'POST':'GET',headers:{authorization:`Bearer ${descriptor.controlToken}`,'content-type':'application/json'},...body?{body:JSON.stringify(body)}:{}});
    for(const route of ['/__dsh-remote-admin/link','/__dsh-remote-admin/reset-link']) {
      assert.equal((await post(descriptor.managementOrigin+route,{})).status,403,'local management still requires the private Bearer credential');
      assert.equal((await post(descriptor.managementOrigin+route,{},{authorization:'Bearer invalid'})).status,403);
      assert.equal((await post(gateway.publicOrigin+route,{})).status,403,'public data listener never exposes management routes');
    }
    assert.equal((await(await management('/__dsh-remote-admin/link')).json()).link,null,'status refresh is read-only');
    assert.equal((await fetch(gateway.publicOrigin+'/',{redirect:'manual'})).status,303);
    assert.equal((await fetch(gateway.publicOrigin+'/api/echo')).status,401);
    const wrongHostStatus=await new Promise((resolve,reject)=>{const request=httpRequest(gateway.publicOrigin+'/healthz',{headers:{host:'attacker.invalid'}},response=>{response.resume();resolve(response.statusCode);});request.once('error',reject);request.end();});
    assert.equal(wrongHostStatus,421);
    const ticket=await(await management('/pair',{})).json();
    assert.equal((await post(gateway.publicOrigin+'/pair/claim',{credential:ticket.code},{origin:'https://attacker.invalid'})).status,403);
    const paired=await post(gateway.publicOrigin+'/pair/claim',{credential:ticket.code,label:'test-browser'},{origin:gateway.publicOrigin});
    assert.equal(paired.status,200);const cookie=paired.headers.getSetCookie()[0].split(';',1)[0],device=(await paired.json()).device;
    assert.equal((await post(gateway.publicOrigin+'/pair/claim',{credential:ticket.secret},{origin:gateway.publicOrigin})).status,401);
    const page=await fetch(gateway.publicOrigin+'/',{headers:{cookie}});
    assert.equal(page.status,200);assert.equal(page.headers.get('set-cookie'),null);assert.ok((await page.text()).includes('__DSH_BOOT__'));
    const body='test-body-'+'.'.repeat(256*1024);
    const echo=await fetch(gateway.publicOrigin+'/api/echo',{method:'POST',headers:{cookie,origin:gateway.publicOrigin,'x-forwarded-user':'spoofed',authorization:'Bearer remote-untrusted'},body});
    assert.equal(await echo.text(),body);assert.equal(observedHeaders.authorization,undefined);assert.equal(observedHeaders['x-forwarded-user'],undefined);
    assert.equal(observedHeaders.cookie,'core_session=fixture-core-secret');assert.equal(observedHeaders.origin,coreOrigin);
    assert.equal((await fetch(gateway.publicOrigin+'/api/echo',{headers:{cookie,origin:'https://attacker.invalid'}})).status,403);
    assert.equal((await fetch(gateway.publicOrigin+'/api/echo',{method:'POST',headers:{cookie},body:'missing-origin'})).status,403);
    assert.equal((await fetch(gateway.publicOrigin+'/?token=forbidden',{headers:{cookie}})).status,403);
    assert.equal((await fetch(gateway.publicOrigin+'/inspector/devtools/',{headers:{cookie}})).status,403);
    assert.equal((await fetch(gateway.publicOrigin+'/%69nspector/devtools/',{headers:{cookie}})).status,403);
    assert.equal((await post(gateway.publicOrigin+'/api/dsh-remote-aliyun-probe/control',{action:'pair'},{cookie,origin:gateway.publicOrigin})).status,403);
    const ws=new WebSocket(gateway.publicOrigin.replace('http:','ws:')+'/api/remote.mux',{headers:{cookie,origin:gateway.publicOrigin}});
    await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
    const received=new Promise(resolve=>ws.once('message',data=>resolve(data.toString())));ws.send('stream-probe');assert.equal(await received,'stream-probe');
    const closed=new Promise(resolve=>ws.once('close',resolve));assert.equal((await management('/revoke',{id:device.id})).status,200);await closed;
    assert.equal((await fetch(gateway.publicOrigin+'/',{headers:{cookie},redirect:'manual'})).status,303);
    const longLink=await(await management('/__dsh-remote-admin/link',{})).json();
    const reconnect=await post(gateway.publicOrigin+'/pair/claim',{credential:longLink.secret},{origin:gateway.publicOrigin});
    const activeCookie=reconnect.headers.getSetCookie()[0].split(';',1)[0];
    assert.equal((await fetch(gateway.publicOrigin+'/remote/access',{headers:{cookie:activeCookie}})).status,200);
    assert.equal((await post(gateway.publicOrigin+'/remote/logout',{},{cookie:activeCookie,origin:'https://attacker.invalid'})).status,403);
    const resetSocket=new WebSocket(gateway.publicOrigin.replace('http:','ws:')+'/api/remote.mux',{headers:{cookie:activeCookie,origin:gateway.publicOrigin}});
    await new Promise((resolve,reject)=>{resetSocket.once('open',resolve);resetSocket.once('error',reject);});
    const resetClosed=new Promise(resolve=>resetSocket.once('close',resolve));
    const newLink=await(await management('/__dsh-remote-admin/reset-link',{})).json();await resetClosed;
    assert.notEqual(newLink.secret,longLink.secret);
    assert.equal((await post(gateway.publicOrigin+'/pair/claim',{credential:longLink.secret},{origin:gateway.publicOrigin})).status,401);
    assert.equal((await fetch(gateway.publicOrigin+'/remote/access',{headers:{cookie:activeCookie}})).status,401);
    const lastPair=await post(gateway.publicOrigin+'/pair/claim',{credential:newLink.secret},{origin:gateway.publicOrigin});
    const lastCookie=lastPair.headers.getSetCookie()[0].split(';',1)[0];
    const logout=await post(gateway.publicOrigin+'/remote/logout',{},{cookie:lastCookie,origin:gateway.publicOrigin});
    assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
    assert.equal((await fetch(gateway.publicOrigin+'/remote/access',{headers:{cookie:lastCookie}})).status,401);
    const publicState=JSON.stringify(await(await management('/status')).json());assert.ok(!publicState.includes('fixture-core-secret')&&!publicState.includes(descriptor.controlToken));
  }finally{
    await gateway?.close();for(const socket of websocketServer.clients)socket.terminate();websocketServer.close();
    if(core)await new Promise(resolve=>{core.close(resolve);core.closeAllConnections();});
    await rm(directory,{recursive:true,force:true});
  }
});
