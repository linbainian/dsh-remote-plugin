import { randomUUID } from 'node:crypto';
import { validatePrivateState, CHANNEL } from './state.mjs';

const READ_ONLY_ENDPOINTS = new Set([`${CHANNEL}/status`, '/api/session/list']);

export async function connectDesktop(rawState, fetchImpl = fetch) {
  const state = validatePrivateState(rawState);
  const request = (url, options = {}) => fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...options });
  const unauthorized = await request(state.origin + '/');
  await unauthorized.body?.cancel();
  if (unauthorized.status !== 401) throw new Error('Desktop root must reject an unauthenticated request');
  const exchange = await request(state.launchUrl);
  await exchange.body?.cancel();
  if (![302, 303].includes(exchange.status)) throw new Error(`Desktop browser bootstrap failed (${exchange.status})`);
  const target = new URL(exchange.headers.get('location') || '', state.origin);
  if (target.origin !== state.origin || target.pathname !== '/' || target.search || target.hash) throw new Error('Unsafe Desktop bootstrap redirect');
  const cookies = exchange.headers.getSetCookie().map(value => value.split(';', 1)[0]).filter(value => /^[A-Za-z0-9_-]+=[^;\r\n]+$/.test(value));
  if (cookies.length === 0) throw new Error('Desktop did not issue a browser session');
  const cookie = cookies.join('; ');
  const authenticated = (url, options = {}) => request(url, { ...options, headers: { Cookie: cookie, Origin: state.origin, ...options.headers } });
  const page = await authenticated(state.origin + '/');
  if (page.status !== 200 || !page.headers.get('content-type')?.includes('text/html')) { await page.body?.cancel(); throw new Error('Authenticated Desktop page is unavailable'); }
  const html = await page.text();
  if (!html.includes('__DSH_BOOT__')) throw new Error('Desktop page has no Host boot injection');
  const { launchUrl: _bootstrapCredential, ...publicState } = state;

  return {
    state: publicState,
    html,
    // Credentials stay in this closure. Callers cannot issue arbitrary mutations.
    async rpc(endpoint, args = {}) {
      if (!READ_ONLY_ENDPOINTS.has(endpoint)) throw new Error('Step 1 verifier only allows read-only probes');
      if (endpoint === `${CHANNEL}/status`) {
        const response = await authenticated(state.origin + '/api' + endpoint);
        if (response.status !== 200) { await response.body?.cancel(); throw new Error(`Authenticated Desktop probe failed (${response.status})`); }
        return await response.json();
      }
      const method = endpoint.startsWith('/api/') ? endpoint.slice(5) : endpoint.slice(CHANNEL.length + 1);
      const rpcId = randomUUID();
      const response = await authenticated(state.origin + endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'client-request', rpcId, method, payload: endpoint.startsWith('/api/') ? { args } : {} }),
      });
      if (response.status !== 200) { await response.body?.cancel(); throw new Error(`Read-only Desktop RPC failed (${response.status})`); }
      const envelope = await response.json();
      if (envelope.type !== 'server-response' || envelope.rpcId !== rpcId || envelope.result?.ok !== true) throw new Error(`Read-only Desktop RPC rejected (${envelope.result?.error?.code || 'invalid-envelope'})`);
      return envelope.result.value;
    },
    async checkStream(WebSocketClass) {
      return await new Promise((resolve, reject) => {
        const url = new URL('/api/remote.mux', state.origin);
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocketClass(url, { headers: { Cookie: cookie, Origin: state.origin }, handshakeTimeout: 10000, followRedirects: false });
        const timer = setTimeout(() => { socket.terminate(); reject(new Error('Desktop stream handshake timed out')); }, 12000);
        socket.once('open', () => {
          clearTimeout(timer);
          socket.close(1000, 'step1 read-only handshake');
          resolve({ path: '/api/remote.mux', authenticatedUpgrade: true });
        });
        socket.once('error', () => { clearTimeout(timer); reject(new Error('Desktop stream handshake failed')); });
        socket.once('unexpected-response', (_request, response) => {
          clearTimeout(timer); response.resume(); socket.terminate(); reject(new Error(`Desktop stream rejected (${response.statusCode})`));
        });
      });
    },
  };
}
