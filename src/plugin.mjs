import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { CHANNEL, defaultStateDirectory, loopbackOrigin, publishState, removeOwnState } from './state.mjs';
import { DesktopRemoteController, controlRoute } from './desktop-controller.mjs';
import { PLUGIN_VERSION, inspectDesktopRuntime } from './compatibility.mjs';

export const name = 'dsh-remote-aliyun';
export const inject = ['webServer', 'connection', 'profileContext'];

/** Attach to the existing Desktop Host. No listener or Agent is created. */
export async function apply(ctx, config = {}) {
  const compatibility = inspectDesktopRuntime(ctx, config.verifiedVersion);
  const { version } = compatibility;
  const port = ctx.webServer.port;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Desktop Host has no ready listening port');
  const origin = loopbackOrigin(`${ctx.webServer.protocol}//127.0.0.1:${port}`);
  const stateDirectory = path.resolve(config.stateDirectory || defaultStateDirectory());
  const instanceId = randomUUID();
  const base = {
    schemaVersion: 1, kind: 'dsh-desktop-step1', profile: 'desktop', version,
    installedBuild: config.installedBuild || null, pluginVersion: PLUGIN_VERSION, compatibility,
    instanceId, hostPid: process.pid, origin, createdAt: new Date().toISOString(),
    allocatedListener: false, publicExposure: false,
  };
  let disposed = false;
  let publication;
  const controller = new DesktopRemoteController({ directory: config.gatewayStateDirectory, configFile: config.gatewayConfigFile, desktopVersion: version });
  const settingsUi = { sectionId: 'remote-control-aliyun', desktopLoaded: false, desktopOpened: false, localWebLoaded: false };
  ctx.effect(() => async () => {
    disposed = true;
    await publication?.catch(() => {});
    await controller.dispose();
    await removeOwnState(stateDirectory, instanceId);
  }, 'dsh-remote-aliyun: local instance descriptor');

  // Only a read-only identity probe. Browser authentication is owned by DSH.
  ctx.connection.fetch.register({
    path: `/api${CHANNEL}/status`, methods: ['GET'], requestBody: 'buffered',
    fetch: async () => {
      const agents = ctx.get('agents')?.list() || [];
      return Response.json({ ...base, settingsUi, loadedSessionIds: agents.map(agent => agent.id).filter(id => typeof id === 'string') });
    },
  });

  const launchUrl = ctx.connection.authenticatedUrl(origin);
  publication = publishState(stateDirectory, { ...base, launchUrl });
  await publication;
  await controller.initialize();
  ctx.connection.fetch.register(controlRoute(controller, (_request, payload) => {
    if (payload?.clientProtocol === 'dsh-app:') {
      settingsUi.desktopLoaded = true;
      if (payload.surface === 'settings') settingsUi.desktopOpened = true;
    } else settingsUi.localWebLoaded = true;
  }));
  if (disposed) await removeOwnState(stateDirectory, instanceId);
  else ctx.logger.info('[dsh-remote-aliyun] desktop settings and local adapter are ready');
}
