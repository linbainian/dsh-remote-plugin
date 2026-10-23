import { mkdir, readFile, rename, rm, writeFile, chmod } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

export const TARGET_VERSION = '0.2.1-rc.2';
export const CHANNEL = '/dsh-remote-aliyun-probe';
export const defaultStateDirectory = () => path.join(process.env.DSH_HOME || path.join(homedir(), '.dsh'), 'remote-aliyun-step1');

export function loopbackOrigin(value) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('A plain 127.0.0.1 Host origin with an explicit port is required');
  }
  return url.origin;
}

export function validatePrivateState(value) {
  if (value?.schemaVersion !== 1 || value?.kind !== 'dsh-desktop-step1' || value?.profile !== 'desktop' || value.version !== TARGET_VERSION || typeof value.instanceId !== 'string' || !Number.isSafeInteger(value.hostPid) || value.hostPid <= 0) {
    throw new Error('Invalid or unsupported Desktop instance descriptor');
  }
  const origin = loopbackOrigin(value.origin);
  const launch = new URL(value.launchUrl);
  if (launch.origin !== origin || launch.pathname !== '/' || launch.username || launch.password || launch.hash || launch.searchParams.size !== 1 || !launch.searchParams.get('token')) {
    throw new Error('Invalid Desktop browser bootstrap URL');
  }
  return { ...value, origin };
}

export async function atomicJson(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temp, file);
    if (process.platform !== 'win32') await chmod(file, 0o600);
  } finally { await rm(temp, { force: true }); }
}

export async function protectStateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') await chmod(directory, 0o700);
  else await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('../scripts/Protect-State.ps1', import.meta.url)), '-StateDirectory', directory], { windowsHide: true, timeout: 15000 });
}

export async function publishState(directory, privateState, protector = protectStateDirectory) {
  await protector(directory);
  const { launchUrl: _secret, ...publicState } = privateState;
  await atomicJson(path.join(directory, 'runtime.private.json'), privateState);
  await atomicJson(path.join(directory, 'status.json'), publicState);
}

export async function removeOwnState(directory, instanceId) {
  // A delayed disposer must never remove a replacement plugin's descriptor.
  for (const name of ['runtime.private.json', 'status.json']) {
    const file = path.join(directory, name);
    try {
      const state = JSON.parse(await readFile(file, 'utf8'));
      if (state.instanceId === instanceId) await rm(file, { force: true });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export async function loadPrivateState(directory = defaultStateDirectory()) {
  return validatePrivateState(JSON.parse(await readFile(path.join(directory, 'runtime.private.json'), 'utf8')));
}
