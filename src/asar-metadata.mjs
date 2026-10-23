import { open } from 'node:fs/promises';

/** Read only the root package manifest of an installed Electron ASAR. */
export async function readInstalledMetadata(archive) {
  const handle = await open(archive, 'r');
  async function exact(buffer, position) {
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
    if (bytesRead !== buffer.length) throw new Error('Truncated Electron archive');
  }
  try {
    const prelude = Buffer.alloc(16);
    await exact(prelude, 0);
    const headerSize = prelude.readUInt32LE(4), jsonSize = prelude.readUInt32LE(12);
    if (prelude.readUInt32LE(0) !== 4 || jsonSize < 2 || headerSize < jsonSize + 8 || headerSize > 32 * 1024 * 1024) throw new Error('Invalid Electron archive header');
    const header = Buffer.alloc(jsonSize);
    await exact(header, 16);
    const entry = JSON.parse(header.toString('utf8'))?.files?.['package.json'];
    const offset = Number(entry?.offset);
    if (!entry || entry.unpacked || entry.link || !Number.isSafeInteger(entry.size) || entry.size < 2 || entry.size > 256 * 1024 || !Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid Electron package manifest entry');
    const buffer = Buffer.alloc(entry.size);
    await exact(buffer, 8 + headerSize + offset);
    const metadata = JSON.parse(buffer.toString('utf8'));
    if (metadata.name !== '@deepseek-ai/dsh-desktop') throw new Error('The installation is not official DeepSeek Harness Desktop');
    return { name: metadata.name, version: metadata.version, build: metadata.dshBuildCommit || null, dirty: metadata.dshBuildDirty ?? null };
  } finally { await handle.close(); }
}
