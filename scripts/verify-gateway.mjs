import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';

const option=name=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];};
const directory=option('--state')||path.join(process.env.DSH_HOME||path.join(homedir(),'.dsh'),'remote-aliyun');
try{
  const state=JSON.parse(await readFile(path.join(directory,'gateway.private.json'),'utf8'));
  const management=new URL(state.managementOrigin);
  if(management.protocol!=='http:'||management.hostname!=='127.0.0.1'||management.username||management.password||management.pathname!=='/')throw new Error('Invalid local management descriptor');
  const request=(url,options={})=>fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000),...options});
  const manage=async(route,body)=>{
    const response=await request(management.origin+route,{method:body?'POST':'GET',headers:{authorization:`Bearer ${state.controlToken}`,'content-type':'application/json'},...body?{body:JSON.stringify(body)}:{}});
    if(!response.ok)throw new Error('Local management failed');return await response.json();
  };
  const origin=option('--origin')||state.publicOrigin;
  const gatewayStatus=await manage('/status');
  if(gatewayStatus.protocolVersion!==2)throw new Error('The running gateway must support protocol version 2');
  const savedLink=(await manage('/__dsh-remote-admin/link')).link;
  const unauthorized=await request(origin+'/api/session/list',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});await unauthorized.body?.cancel();
  if(unauthorized.status!==401)throw new Error('Unpaired access was not rejected');
  const ticket=await manage('/pair',{});
  const claim=await request(origin+'/pair/claim',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({credential:ticket.secret,label:'Automated gateway verification'})});
  if(!claim.ok)throw new Error(`Pairing failed (${claim.status})`);
  const cookie=claim.headers.getSetCookie()[0]?.split(';',1)[0],device=(await claim.json()).device;
  if(!cookie)throw new Error('Gateway did not issue a device session');
  try{
    const page=await request(origin+'/',{headers:{cookie}});
    if(page.status!==200||page.headers.has('set-cookie')||!(await page.text()).includes('__DSH_BOOT__'))throw new Error('DSH page did not pass through the authenticated gateway');
    const access=await request(origin+'/remote/access',{headers:{cookie}});
    if(access.status!==200||(await access.json()).device?.id!==device.id)throw new Error('Device-scoped access status failed');
    const privateRoute=await request(origin+'/__dsh-remote-admin/link',{headers:{cookie}});await privateRoute.body?.cancel();
    if(privateRoute.status!==403)throw new Error('Public management route was not blocked');
    const rpcId=randomUUID();
    const response=await request(origin+'/api/session/list',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId,method:'session/list',payload:{args:{_request:{}}}})});
    const envelope=await response.json();
    if(response.status!==200||envelope.rpcId!==rpcId||!envelope.result?.ok||!Array.isArray(envelope.result.value?.items))throw new Error('The real Desktop session list was not readable through the gateway');
    const socket=new WebSocket(origin.replace(/^http/,'ws')+'/api/remote.mux',{headers:{cookie,origin},handshakeTimeout:10000});
    await new Promise((resolve,reject)=>{socket.once('open',resolve);socket.once('error',()=>reject(new Error('Gateway WebSocket failed')));});
    const closed=new Promise(resolve=>socket.once('close',resolve));
    await manage('/revoke',{id:device.id});
    await Promise.race([closed,new Promise((_,reject)=>setTimeout(()=>{socket.terminate();reject(new Error('Revocation did not close the active socket'));},5000).unref())]);
    const revoked=await request(origin+'/api/session/list',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:'{}'});await revoked.body?.cancel();
    if(revoked.status!==401)throw new Error('Revoked device retained access');
    const report={verifiedAt:new Date().toISOString(),origin,gatewayVersion:gatewayStatus.gatewayVersion,protocolVersion:gatewayStatus.protocolVersion,publicTls:origin.startsWith('https:'),unpairedAccessRejected:true,pairingAccepted:true,desktopPageLoaded:true,deviceStatusAccessible:true,publicManagementBlocked:true,persistentLinkStored:!!savedLink,persistentLinkExpiresAt:savedLink?.expiresAt??null,visibleSessionCount:envelope.result.value.items.length,webSocketUpgrade:true,revocationClosedLiveSocket:true,revokedAccessRejected:true,scope:'Real Desktop through the gateway; read-only session list and WebSocket connection. No messages were submitted and no approvals were answered. Reset behavior is covered by isolated fixture tests; this verification does not reset the user link or revoke other devices.'};
    if(option('--report'))await writeFile(option('--report'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }finally{await manage('/revoke',{id:device.id}).catch(()=>{});}
}catch(error){console.error(`Gateway verification failed: ${error.message}`);process.exitCode=1;}
