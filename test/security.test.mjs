import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addManagedPatch, removeManagedPatch } from '../src/profile-patch.mjs';
import { loopbackOrigin, publishState, removeOwnState, validatePrivateState } from '../src/state.mjs';
import { connectDesktop } from '../src/desktop-client.mjs';
import { apply } from '../src/plugin.mjs';
import {temporary} from './helpers.mjs';

const state = () => ({ schemaVersion: 1, kind: 'dsh-desktop-step1', profile: 'desktop', version: '0.2.1-rc.2', instanceId: 'test-generation', hostPid: 123,
  origin: 'http://127.0.0.1:12345', launchUrl: 'http://127.0.0.1:12345/?token=test-secret' });

test('rejects remote origins, URL credentials, paths and mismatched bootstrap authority', () => {
  for (const value of ['http://example.com:12345', 'http://0.0.0.0:12345', 'http://user@127.0.0.1:12345', 'http://127.0.0.1:12345/path', 'http://127.0.0.1:12345/?token=secret']) assert.throws(() => loopbackOrigin(value));
  assert.throws(() => validatePrivateState({ ...state(), launchUrl: 'http://127.0.0.1:9999/?token=test-secret' }));
  assert.throws(() => validatePrivateState({ ...state(), version: '0.2.2' }));
});

test('bootstrap refuses cross-origin redirects without forwarding credentials', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? new Response('', { status: 401 }) : new Response('', { status: 302, headers: { location: 'https://example.com/' } });
  };
  await assert.rejects(connectDesktop(state(), fetcher), /Unsafe Desktop bootstrap redirect/);
  assert.equal(calls.length, 2);
  assert.ok(calls.every(call => !call.options.headers?.Cookie));
});

test('read-only client rejects mutations before any network request', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls++;
    if (calls === 1) return new Response('', { status: 401 });
    if (calls === 2) return new Response('', { status: 302, headers: { location: './', 'set-cookie': 'dsh-session=fake-session; HttpOnly; SameSite=Strict' } });
    return new Response('<html><script>window.__DSH_BOOT__={}</script></html>', { headers: { 'content-type': 'text/html' } });
  };
  const client = await connectDesktop(state(), fetcher);
  await assert.rejects(client.rpc('/api/session/create'), /only allows read-only/);
  assert.equal(calls, 3);
  assert.equal(JSON.stringify(client).includes('fake-session'), false);
  assert.equal(JSON.stringify(client).includes('test-secret'), false);
});

for (const original of ['[]', '[]\n', '[]\r\n', '\uFEFF# user config\r\n[]\r\n']) {
  test(`managed patch preserves existing bytes and round-trips (${JSON.stringify(original)})`, () => {
    const next = addManagedPatch(original, 'file:///C:/some%20folder/plugin.mjs', { stateDirectory: 'C:\\private', verifiedVersion: '0.2.1-rc.2' });
    assert.ok(next.startsWith(original));
    assert.equal(removeManagedPatch(next), original);
    assert.equal(addManagedPatch(next, 'file:///C:/some%20folder/plugin.mjs', { stateDirectory: 'C:\\private', verifiedVersion: '0.2.1-rc.2' }), next);
  });
}

test('ambiguous markers refuse profile changes', () => {
  assert.throws(() => removeManagedPatch('[]\n# BEGIN dsh-remote-aliyun-step1\n'), /Ambiguous/);
});

test('public state excludes bootstrap credentials and old cleanup preserves a new generation', async () => {
  const directory = await temporary('dsh-remote-state-');
  try {
    const alreadyPrivate = async () => {}; // Directory ACLs are covered by the real Windows installation check.
    await publishState(directory, state(), alreadyPrivate);
    assert.equal((await readFile(path.join(directory, 'status.json'), 'utf8')).includes('test-secret'), false);
    await publishState(directory, { ...state(), instanceId: 'new-generation' }, alreadyPrivate);
    await removeOwnState(directory, 'test-generation');
    assert.equal(JSON.parse(await readFile(path.join(directory, 'runtime.private.json'))).instanceId, 'new-generation');
    await removeOwnState(directory, 'new-generation');
    await assert.rejects(readFile(path.join(directory, 'runtime.private.json')), { code: 'ENOENT' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('host adapter refuses another profile before publishing an operator credential', async () => {
  await assert.rejects(apply({ get: () => ({ name: 'web' }) }), /running desktop profile/);
});
