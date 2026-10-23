import {mkdir,mkdtemp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

export async function temporary(prefix) {
  const root=fileURLToPath(new URL('../.test-tmp/',import.meta.url));
  await mkdir(root,{recursive:true});return await mkdtemp(path.join(root,prefix));
}
export const gatewayConfig=(directory,publicOrigin='https://203.0.113.10:8443')=>({publicOrigin,ssh:{destination:'fixture@203.0.113.10',identityFile:path.join(directory,'fixture-key'),port:22,remotePort:18181}});
