import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { createGateway } from '../src/gateway.mjs';
import { createSshTunnel } from '../src/ssh-tunnel.mjs';
import { atomicJson, defaultStateDirectory } from '../src/state.mjs';

const option=name=>{const index=process.argv.indexOf(name);return index<0?undefined:process.argv[index+1];};
const stateDirectory=path.resolve(option('--state')||path.join(process.env.DSH_HOME||path.join(homedir(),'.dsh'),'remote-aliyun'));
const command=process.argv[2]||'status';
try {
  if(command==='start'){
    const config=JSON.parse(await readFile(option('--config')||path.join(stateDirectory,'config.private.json'),'utf8'));
    let tunnel;
    const gateway=await createGateway({stateDirectory,instanceStateDirectory:defaultStateDirectory(),publicOrigin:config.publicOrigin,
      allowLoopbackHttp:config.allowLoopbackHttp===true,transportStatus:()=>tunnel?.status()||{phase:config.ssh?'starting':'local-only'},onClose:()=>tunnel?.stop()});
    if(config.ssh){
      try {tunnel=await createSshTunnel(config.ssh,gateway.gatewayOrigin,stateDirectory);}
      catch(error){await gateway.close();throw error;}
    }
    console.log(JSON.stringify({ready:true,publicOrigin:gateway.publicOrigin,gatewayOrigin:gateway.gatewayOrigin,transport:tunnel?.status()||null}));
    process.once('SIGINT',()=>void gateway.close());process.once('SIGTERM',()=>void gateway.close());
  }else{
    const state=JSON.parse(await readFile(path.join(stateDirectory,'gateway.private.json'),'utf8'));
    const origin=new URL(state.managementOrigin);
    if(origin.protocol!=='http:'||origin.hostname!=='127.0.0.1'||!origin.port||origin.username||origin.password||origin.pathname!=='/')throw new Error('Invalid local management descriptor');
    const route=({status:'status',devices:'devices',pair:'pair',link:'__dsh-remote-admin/link',revoke:'revoke',stop:'stop'})[command];
    if(!route)throw new Error('Use start, status, link, pair, devices, revoke or stop');
    const response=await fetch(origin.origin+'/'+route,{redirect:'error',method:['status','devices'].includes(command)?'GET':'POST',
      headers:{authorization:`Bearer ${state.controlToken}`,'content-type':'application/json'},
      ...command==='revoke'?{body:JSON.stringify({id:option('--device')})}:{},signal:AbortSignal.timeout(5000)});
    if(!response.ok)throw new Error(`Local management request failed (${response.status})`);
    const result=await response.json();
    if(['pair','link'].includes(command)&&process.argv.includes('--private')){
      const file=path.join(stateDirectory,command==='link'?'access-link.private.json':'pairing.private.json');await atomicJson(file,result);
      console.log(JSON.stringify({issued:true,expiresAt:result.expiresAt,privateFile:file}));
    }else console.log(JSON.stringify(result,null,2));
  }
}catch(error){console.error(`Remote gateway: ${error.code==='ENOENT'?'configuration or local gateway state not found':error.message}`);process.exitCode=1;}
