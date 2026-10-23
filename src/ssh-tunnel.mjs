import { spawn } from 'node:child_process';
import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function sshArguments(config, gatewayOrigin, isolatedConfig) {
  const local = new URL(gatewayOrigin);
  if (local.protocol !== 'http:' || local.hostname !== '127.0.0.1' || !local.port) throw new Error('SSH must forward the local authentication gateway');
  if (!/^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+$/.test(config.destination) || !path.isAbsolute(config.identityFile)) throw new Error('Invalid SSH destination or identity path');
  if (!Number.isInteger(config.remotePort) || config.remotePort < 1024 || config.remotePort > 65535 || config.remotePort === 18080) throw new Error('Choose an unused private remote port; existing port 18080 is reserved');
  if (config.port !== undefined && (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)) throw new Error('Invalid SSH port');
  return ['-F',isolatedConfig,'-N','-T','-v','-p',String(config.port||22),'-i',config.identityFile,
    '-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','-o','IdentitiesOnly=yes','-o','ExitOnForwardFailure=yes',
    '-o','ConnectTimeout=8','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=3',
    '-R',`127.0.0.1:${config.remotePort}:127.0.0.1:${local.port}`,config.destination];
}

export async function createSshTunnel(config, gatewayOrigin, stateDirectory) {
  await access(config.identityFile);
  const isolatedConfig=path.join(stateDirectory,'ssh.client.conf');
  await writeFile(isolatedConfig,'# Dedicated DSH tunnel. Existing SSH configuration and forwards are unchanged.\n',{mode:0o600});
  const args=sshArguments(config,gatewayOrigin,isolatedConfig);
  let child, stopped=false, timer, phase='idle', retry=0, lastFailure=null;
  const start=()=>new Promise((resolve,reject)=>{
    phase='connecting';let ready=false,stderr='';
    child=spawn(config.executable||'ssh',args,{windowsHide:true,stdio:['ignore','ignore','pipe']});
    const deadline=setTimeout(()=>{lastFailure='ssh-ready-timeout';child.kill();},15000);
    child.stderr.on('data',chunk=>{
      stderr=(stderr+chunk.toString()).slice(-16384);
      if(!ready&&/remote forward success for:/.test(stderr)){ready=true;phase='ready';retry=0;lastFailure=null;clearTimeout(deadline);resolve();}
    });
    child.once('error',()=>{clearTimeout(deadline);lastFailure='ssh-start-failed';if(!ready)reject(new Error(lastFailure));});
    child.once('exit',()=>{
      clearTimeout(deadline);phase=stopped?'stopped':'reconnecting';
      lastFailure=/Permission denied/.test(stderr)?'ssh-authentication-failed':/Host key verification failed/.test(stderr)?'ssh-host-key-rejected':lastFailure||'ssh-disconnected';
      if(!ready)reject(new Error(lastFailure));
      if(!stopped)timer=setTimeout(()=>{void start().catch(()=>{});},Math.min(30000,1000*2**Math.min(retry++,5)));
    });
  });
  try { await start(); }
  catch(error) { stopped=true;clearTimeout(timer);child?.kill();throw error; }
  return {
    status:()=>({phase,pid:child?.pid||null,remotePort:config.remotePort,lastFailure}),
    stop:async()=>{
      stopped=true;phase='stopped';clearTimeout(timer);
      const current=child;
      if(current && current.exitCode===null && current.signalCode===null)await new Promise(resolve=>{
        const deadline=setTimeout(resolve,3000);current.once('exit',()=>{clearTimeout(deadline);resolve();});current.kill();
      });
    },
  };
}
