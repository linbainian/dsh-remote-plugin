import { writeFile } from 'node:fs/promises';
import WebSocket from 'ws';
import { loadPrivateState, CHANNEL } from '../src/state.mjs';
import { connectDesktop } from '../src/desktop-client.mjs';

const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
try {
  const state = await loadPrivateState(option('--state'));
  const client = await connectDesktop(state);
  const identity = await client.rpc(`${CHANNEL}/status`);
  if (identity.instanceId !== state.instanceId || identity.hostPid !== state.hostPid) throw new Error('The probe is attached to a different Host generation');
  const sessions = await client.rpc('/api/session/list', { _request: {} });
  if (!Array.isArray(sessions?.items)) throw new Error('Unexpected Desktop session list shape');
  const visibleIds = new Set(sessions.items.map(item => item.sessionId));
  const loadedIds = identity.loadedSessionIds || [];
  const matchedLoadedSessions = loadedIds.filter(id => visibleIds.has(id)).length;
  const stream = await client.checkStream(WebSocket);
  const report = {
    verifiedAt: new Date().toISOString(), version: state.version, installedBuild: state.installedBuild,
    hostPid: state.hostPid, origin: state.origin, sameHostGeneration: true,
    pluginVersion: identity.pluginVersion || null, settingsUi: identity.settingsUi || null,
    unauthenticatedRootRejected: true, authenticatedPageLoaded: true,
    sessionListRead: true, visibleSessionCount: sessions.items.length,
    loadedAgentCount: loadedIds.length, matchedLoadedSessions,
    ...stream, allocatedListener: false, publicExposure: false,
    scope: 'Real Desktop HTTP authentication, read-only session list and WebSocket upgrade; no message submission or approval was performed.',
  };
  if (option('--report')) await writeFile(option('--report'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(`Desktop verification failed: ${error.code === 'ENOENT' ? 'local plugin state not found; install and enable the native plugin in DSH first' : error.message}`);
  process.exitCode = 1;
}
