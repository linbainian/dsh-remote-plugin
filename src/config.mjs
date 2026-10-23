import path from 'node:path';
import { isIP } from 'node:net';

/** Only settings needed by the SSH relay; private key contents are never read. */
export function validateGatewayConfig(value) {
  let url;
  try { url=new URL(value?.publicOrigin); } catch { throw new Error('请输入完整的 HTTPS 访问入口。'); }
  if(url.protocol!=='https:' || !isIP(url.hostname) || url.username || url.password || url.pathname!=='/' || url.search || url.hash) throw new Error('访问入口必须是 HTTPS 公网 IP 地址，可附带端口，不包含路径或凭据。');
  const ssh=value?.ssh;
  if(!ssh || typeof ssh.destination!=='string' || !/^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+$/.test(ssh.destination)) throw new Error('SSH 连接地址格式应为 用户名@服务器地址。');
  if(typeof ssh.identityFile!=='string' || !path.isAbsolute(ssh.identityFile) || ssh.identityFile.length>1024) throw new Error('请输入本机 SSH 私钥文件的绝对路径。');
  const port=ssh.port??22, remotePort=ssh.remotePort??18181;
  if(!Number.isInteger(port)||port<1||port>65535) throw new Error('SSH 端口无效。');
  if(!Number.isInteger(remotePort)||remotePort<1024||remotePort>65535||remotePort===18080) throw new Error('请选择未占用的独立转发端口，避免与现有通道冲突。');
  return {publicOrigin:url.origin,ssh:{destination:ssh.destination,identityFile:ssh.identityFile,port,remotePort}};
}
