import { open, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import QRCode from 'qrcode';
import { DeviceStore } from './auth-store.mjs';
import { validateGatewayConfig } from './config.mjs';
import { atomicJson, loopbackOrigin, protectStateDirectory } from './state.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const defaultDirectory = () => path.join(process.env.DSH_HOME || path.join(homedir(), '.dsh'), 'remote-aliyun');

/** Owns desktop UI operations. Neither SSH nor control credentials enter the client. */
export class DesktopRemoteController {
  constructor(options = {}) {
    this.directory = options.directory || defaultDirectory();
    this.configFile = options.configFile || path.join(this.directory, 'config.private.json');
    this.executable = options.executable || process.execPath;
    this.launch = options.launch || spawn;
    this.enabled = false;
    this.configured = false;
    this.publicOrigin = null;
    this.configuration = null;
    this.phase = null;
    this.ticket = null;
    this.pairingState = 'none';
    this.child = null;
    this.disposed = false;
    this.queue = Promise.resolve();
    this.startTask = null;
    this.lastError = null;
  }

  async initialize() {
    await protectStateDirectory(this.directory);
    try { this.setConfiguration(validateGatewayConfig(JSON.parse(await readFile(this.configFile, 'utf8')))); }
    catch(error) { if(error.code!=='ENOENT') this.lastError='无法加载远程配置，请在设置页重新填写并保存。'; }
    try {
      const preference = JSON.parse(await readFile(path.join(this.directory, 'desktop.private.json'), 'utf8'));
      if (preference.schemaVersion !== 1 || typeof preference.enabled !== 'boolean') throw new Error('远程控制设置文件无效。');
      this.enabled = preference.enabled;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if(!this.configured) return;
    const current = await this.probe();
    // Adopt the previously configured gateway without replacing its device records.
    if (current) { this.enabled = true; await this.savePreference(); }
    else if (this.enabled) {
      this.startTask = this.action({ action: 'start', generateLink: false }).catch(error => { this.lastError = error.message; });
    }
  }

  async savePreference() { await atomicJson(path.join(this.directory, 'desktop.private.json'), { schemaVersion: 1, enabled: this.enabled }); }

  setConfiguration(config) { this.configuration=config;this.publicOrigin=config.publicOrigin;this.configured=true; }

  async configure(value) {
    if(await this.probe()) throw new Error('请先停止远程控制，再修改服务器配置。');
    const config=validateGatewayConfig(value);
    await atomicJson(this.configFile,config);
    this.setConfiguration(config);this.ticket=null;
    this.enabled=false;await this.savePreference();
  }

  async descriptor() {
    const state = JSON.parse(await readFile(path.join(this.directory, 'gateway.private.json'), 'utf8'));
    if (state.schemaVersion !== 1 || typeof state.instanceId !== 'string' || !Number.isInteger(state.pid) || !/^[A-Za-z0-9_-]{43}$/.test(state.controlToken)) throw new Error('本机网关状态无效。');
    state.managementOrigin = loopbackOrigin(state.managementOrigin);
    return state;
  }

  async manage(route, body, timeout = 1500) {
    const state = await this.descriptor();
    const response = await fetch(state.managementOrigin + '/' + route, {
      method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(timeout),
      headers: { authorization: `Bearer ${state.controlToken}`, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new Error('本机网关没有接受此操作，请稍后重试。');
    const value = await response.json();
    if (route === 'status' && value.instanceId !== state.instanceId) throw new Error('网关实例已变化，请刷新后重试。');
    return value;
  }

  async probe() {
    try { return await this.manage('status'); }
    catch { return null; }
  }

  async snapshot() {
    const status = await this.probe();
    const phase = this.phase || (!this.configured ? 'unconfigured' : status ? status.protocolVersion === 2 ? status.transport?.phase || 'ready' : 'update-required' : this.lastError ? 'error' : 'stopped');
    let devices = [];
    if (status) {
      devices = (await this.manage('devices')).devices;
      if (status.protocolVersion === 2) await this.cacheLink((await this.manage('__dsh-remote-admin/link')).link);
    } else {
      const stored = new DeviceStore(this.directory); await stored.load();
      devices = stored.list(); await this.cacheLink(stored.existingAccessLink());
    }
    return { enabled: this.enabled, configured:this.configured, configurationSupported:true, configuration:this.configuration, phase, publicOrigin: this.publicOrigin, devices,
      connectedDevices: status?.connectedDevices || 0, link: this.ticket, pairingState: this.ticket ? 'ready' : 'none',
      error: this.lastError, desktopVersion: '0.2.1-rc.2', protocolVersion: 2,
      gatewayUpdateRequired: !!status && status.protocolVersion !== 2 };
  }

  async start() {
    if(!this.configured) throw new Error('请先填写并保存服务器配置。');
    let status = await this.probe();
    if (status?.transport?.phase === 'ready') return status;
    if (!status) {
      const stdout = await open(path.join(this.directory, 'gateway.stdout.log'), 'a', 0o600);
      const stderr = await open(path.join(this.directory, 'gateway.stderr.log'), 'a', 0o600);
      try {
        this.child = this.launch(this.executable, [path.join(projectRoot, 'scripts', 'remote.mjs'), 'start', '--config', this.configFile, '--state', this.directory], {
          cwd: projectRoot, windowsHide: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', stdout.fd, stderr.fd],
        });
        this.child.once('error', () => { this.lastError = '无法启动本机远程网关。'; });
        this.child.unref();
      } finally { await stdout.close(); await stderr.close(); }
    }
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (this.disposed) throw new Error('桌面插件已停止。');
      status = await this.probe();
      if (status?.transport?.phase === 'ready') return status;
      if (this.child && (this.child.exitCode !== null || this.child.signalCode !== null)) throw new Error('连接阿里云失败，请检查 SSH 和网络后重试。');
      await delay(250);
    }
    throw new Error('连接阿里云超时，请检查网络后重试。');
  }

  async stop() {
    const status = await this.probe();
    if (!status) return;
    await this.manage('stop', {});
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      let current;
      try { current = await this.descriptor(); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
      if (current.instanceId !== status.instanceId) return;
      await delay(200);
    }
    throw new Error('网关仍在关闭，请稍后刷新状态。');
  }

  async cacheLink(link) {
    if (!link || !this.configured) { this.ticket = null; return; }
    const address = link.url || `${this.publicOrigin}/pair#${link.secret}`;
    const url = new URL(address);
    if (url.origin !== this.publicOrigin || url.pathname !== '/pair' || url.search || !/^[A-Za-z0-9_-]{43}$/.test(url.hash.slice(1)) || link.expiresAt !== null || typeof link.generation !== 'string') throw new Error('网关返回了无效的访问链接。');
    if (this.ticket?.generation === link.generation && this.ticket.url === address) return;
    const qrDataUrl = await QRCode.toDataURL(address, { width: 256, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } });
    this.ticket = { url:address, expiresAt:null, generation:link.generation, createdAt:link.createdAt, qrDataUrl };
  }

  async issueLink(reset = false) {
    const status = await this.probe();
    if (status && status.protocolVersion !== 2) throw new Error('远程通道仍是旧版。请在设置中手动停止，再重新开启以加载更新。');
    if (status?.transport?.phase !== 'ready') throw new Error('请先开启远程控制并等待服务器连接完成。');
    await this.cacheLink(await this.manage('__dsh-remote-admin/' + (reset ? 'reset-link' : 'link'), {}));
  }

  action(input) {
    if (input?.action === 'status') return this.snapshot();
    if (!input || !['configure', 'start', 'stop', 'pair', 'reset-link', 'revoke'].includes(input.action)) return Promise.reject(new Error('不支持的远程控制操作。'));
    const operation = this.queue.catch(() => {}).then(async () => {
      if (this.disposed) throw new Error('桌面插件已停止。');
      this.lastError = null;
      try {
        if (input.action === 'configure') await this.configure(input.configuration);
        else if (input.action === 'start') {
          if(!this.configured) throw new Error('请先填写并保存服务器配置。');
          this.phase = 'starting'; this.enabled = true; await this.savePreference();
          await this.start();
          // Starting a tunnel never creates a persistent credential implicitly.
          if (input.generateLink === true) await this.issueLink();
        } else if (input.action === 'stop') {
          this.phase = 'stopping'; this.enabled = false; this.ticket = null; this.pairingState = 'none'; await this.savePreference(); await this.stop();
        } else if (input.action === 'pair') await this.issueLink();
        else if (input.action === 'reset-link') {
          if (input.confirmReset !== true) throw new Error('请先确认重置链接并断开已授权设备。');
          await this.issueLink(true);
        }
        else {
          if (typeof input.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(input.id)) throw new Error('设备标识无效。');
          await this.manage('revoke', { id: input.id });
        }
      } catch (error) { this.lastError = error.message; throw error; }
      finally { this.phase = null; }
      return await this.snapshot();
    });
    this.queue = operation;
    return operation;
  }

  async dispose() {
    this.disposed = true;
    await this.queue.catch(() => {});
    this.ticket = null;
    // Preserve the user's enabled preference so Desktop's next launch restores it.
    if (this.enabled) await this.stop().catch(() => {});
  }
}

export function controlRoute(controller, onClientRequest) {
  return {
    path: '/api/dsh-remote-aliyun-probe/control', methods: ['POST'], requestBody: 'buffered',
    fetch: async request => {
      let body;
      try {
        const text = await request.text();
        if (text.length > 4096) return new Response('too large', { status: 413 });
        body = JSON.parse(text);
        if (body.type !== 'client-request' || typeof body.rpcId !== 'string' || body.rpcId.length > 128 || body.method !== 'dsh-remote-aliyun-probe/control') return new Response('invalid request', { status: 400 });
      } catch { return new Response('invalid request', { status: 400 }); }
      onClientRequest?.(request, body.payload);
      try {
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result: { ok: true, value: await controller.action(body.payload) } });
      } catch (error) {
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result: { ok: false, error: { code: 'DSH_REMOTE_CONTROL', message: error.message, details: {} } } });
      }
    },
  };
}
