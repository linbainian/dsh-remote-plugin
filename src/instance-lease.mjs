import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { realpath } from 'node:fs/promises';

// Kernel-owned IPC disappears on process exit, so a crash leaves no stale lock.
export async function acquireInstanceLease(directory) {
  if (!['win32', 'linux'].includes(process.platform)) throw new Error('The gateway currently supports Windows and Linux');
  const canonical = await realpath(path.resolve(directory));
  const digest = createHash('sha256').update(process.platform === 'win32' ? canonical.toLowerCase() : canonical).digest('hex');
  const address = process.platform === 'win32' ? `\\\\.\\pipe\\dsh-remote-${digest}` : `\0dsh-remote-${digest}`;
  const server = createServer(socket => socket.destroy());
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(address, () => { server.removeListener('error', reject); resolve(); }); });
  } catch (error) {
    if (error.code === 'EADDRINUSE') throw new Error('A gateway already owns this state directory; use status or stop first');
    throw error;
  }
  return { close: () => new Promise(resolve => server.close(resolve)) };
}
