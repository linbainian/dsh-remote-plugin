export const PLUGIN_VERSION = '0.5.2';
export const TESTED_DESKTOP_VERSIONS = Object.freeze(['0.2.1-rc.2', '0.2.1-rc.3']);

// Version is runtime metadata. Authentication and compatibility are checked
// separately, so a Desktop update does not invalidate an existing descriptor.
export function isDesktopVersion(value) {
  return typeof value === 'string' && value.length <= 128 && value === value.trim()
    && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value);
}

export function inspectDesktopRuntime(ctx, configuredVersion, runtimeVersion = process.env.DSH_CLIENT_VERSION) {
  if (ctx.get('profileContext')?.name !== 'desktop') throw new Error('This adapter requires the running desktop profile');
  const version = runtimeVersion ?? configuredVersion;
  if (!isDesktopVersion(version)) throw new Error('DSH Desktop did not provide a valid runtime version');
  const missing = [];
  if (typeof ctx.connection?.authenticatedUrl !== 'function') missing.push('connection.authenticatedUrl');
  if (typeof ctx.connection?.fetch?.register !== 'function') missing.push('connection.fetch.register');
  if (typeof ctx.effect !== 'function') missing.push('effect');
  if (!ctx.webServer || !Number.isInteger(ctx.webServer.port) || ctx.webServer.port < 1 || ctx.webServer.port > 65535) missing.push('webServer.port');
  if (!['http:', 'https:'].includes(ctx.webServer?.protocol)) missing.push('webServer.protocol');
  if (missing.length) throw new Error(`DSH Desktop ${version} is missing required plugin APIs: ${missing.join(', ')}`);
  return { version, tested: TESTED_DESKTOP_VERSIONS.includes(version), testedVersions: [...TESTED_DESKTOP_VERSIONS] };
}
