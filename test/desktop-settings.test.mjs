import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { request } from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import jsQR from 'jsqr';
import pngjs from 'pngjs';
import { createGateway } from '../src/gateway.mjs';
import { DesktopRemoteController, controlRoute } from '../src/desktop-controller.mjs';
import {temporary as createTemporary,gatewayConfig} from './helpers.mjs';

const temporary = () => createTemporary('desktop-settings-');

test('desktop controls generate a decodable persistent link only on request, preserve it when stopped, and reset explicitly', async () => {
  const directory = await temporary();
  const publicOrigin = 'https://203.0.113.10:8443';
  let gateway, controller;
  try {
    gateway = await createGateway({ stateDirectory: directory, instanceStateDirectory: directory, publicOrigin, transportStatus: () => ({ phase: 'ready' }) });
    const configFile = path.join(directory, 'config.json');
    await writeFile(configFile, JSON.stringify(gatewayConfig(directory,publicOrigin)));
    controller = new DesktopRemoteController({ directory, configFile, launch: () => { throw new Error('must adopt, never replace'); } });
    await controller.initialize();
    const initial = await controller.action({ action: 'status' });
    assert.equal(initial.phase, 'ready');
    assert.equal(initial.link, null, 'viewing settings cannot create a credential');
    assert.equal(initial.protocolVersion, 2);
    const paired = await controller.action({ action: 'pair' });
    const pixels = pngjs.PNG.sync.read(Buffer.from(paired.link.qrDataUrl.split(',')[1], 'base64'));
    const decoded = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
    assert.equal(decoded.data, paired.link.url, 'independent QR decoder must recover the exact access link');
    const descriptor = JSON.parse(await readFile(path.join(directory, 'gateway.private.json')));
    assert.ok(!JSON.stringify(paired).includes(descriptor.controlToken));
    assert.ok(!JSON.stringify(paired).includes(descriptor.managementOrigin));
    const result = await new Promise((resolve, reject) => {
      const requestBody = JSON.stringify({ credential: new URL(paired.link.url).hash.slice(1), label: 'phone fixture' });
      const outgoing = request(gateway.gatewayOrigin + '/pair/claim', { method: 'POST', headers: { host: new URL(publicOrigin).host, origin: publicOrigin, 'content-type': 'application/json', 'content-length': Buffer.byteLength(requestBody) } }, response => {
        const chunks=[]; response.on('data', data => chunks.push(data)); response.on('end', () => resolve({ status:response.statusCode, body:JSON.parse(Buffer.concat(chunks)) }));
      });
      outgoing.once('error', reject); outgoing.end(requestBody);
    });
    assert.equal(result.status, 200);
    const claimed = await controller.action({ action: 'status' });
    assert.equal(claimed.link.url, paired.link.url); assert.equal(claimed.devices.length, 1);
    assert.equal((await controller.action({action:'pair'})).link.url, paired.link.url, 'Generate reuses the existing link');
    await assert.rejects(controller.action({action:'reset-link'}), /确认/);
    const revoked = await controller.action({ action: 'revoke', id: result.body.device.id });
    assert.equal(revoked.devices.length, 0);
    const reset=await controller.action({action:'reset-link',confirmReset:true});
    assert.notEqual(reset.link.url,paired.link.url);
    const stopped = await controller.action({ action: 'stop' });
    assert.equal(stopped.phase, 'stopped'); assert.equal(stopped.enabled, false);
    assert.equal(stopped.link.url,reset.link.url,'stopping preserves the link');
    const reopened=new DesktopRemoteController({directory,configFile}); await reopened.initialize();
    assert.equal((await reopened.action({action:'status'})).link.url,reset.link.url,'desktop restart preserves the link without starting a gateway');
    await reopened.dispose();
    assert.equal(JSON.parse(await readFile(path.join(directory, 'desktop.private.json'))).enabled, false);
  } finally { await controller?.dispose(); await gateway?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('settings route uses the actual DSH RPC envelope and rejects malformed or oversized requests', async () => {
  const route = controlRoute({ action: async payload => { if (payload.action === 'bad') throw new Error('refused'); return { phase: 'ready' }; } });
  const send = body => route.fetch(new Request('http://127.0.0.1:1' + route.path, { method: 'POST', body: JSON.stringify(body) }));
  const body = { type:'client-request', rpcId:'id1', method:'dsh-remote-aliyun-probe/control', payload:{action:'status'} };
  assert.deepEqual(await (await send(body)).json(), { type:'server-response', rpcId:'id1', result:{ok:true,value:{phase:'ready'}} });
  const failure = await (await send({...body,payload:{action:'bad'}})).json();
  assert.equal(failure.result.ok, false); assert.equal(failure.result.error.code, 'DSH_REMOTE_CONTROL');
  assert.equal((await send({...body,method:'wrong-endpoint'})).status, 400);
  assert.equal((await send({...body,payload:'x'.repeat(5000)})).status, 413);
});

test('opening settings with a legacy gateway requests a manual update without stopping existing connections',async()=>{
  const directory=await temporary();let controller,stops=0;
  try{
    const configFile=path.join(directory,'config.json');await writeFile(configFile,JSON.stringify(gatewayConfig(directory)));
    controller=new DesktopRemoteController({directory,configFile,launch:()=>{throw new Error('must not replace the live gateway');}});
    controller.probe=async()=>({transport:{phase:'ready'}});
    controller.manage=async route=>{assert.equal(route,'devices');return{devices:[]};};
    controller.stop=async()=>{stops++;};
    await controller.initialize();
    const view=await controller.action({action:'status'});
    assert.equal(view.phase,'update-required');assert.equal(view.gatewayUpdateRequired,true);assert.equal(stops,0);
    await assert.rejects(controller.action({action:'pair'}),/旧版/);assert.equal(stops,0);
    await controller.action({action:'stop'});assert.equal(stops,1,'only an explicit stop interrupts the legacy gateway');
  }finally{await controller?.dispose();await rm(directory,{recursive:true,force:true});}
});

test('client registers the Desktop settings slot and uses only a mobile shell slot on the public relay', async () => {
  const source = await readFile(new URL('../client/index.js', import.meta.url), 'utf8');
  let registration;
  vm.runInNewContext(source, { window:{__ModuleLoader__:{load: value => {registration=value;}}} });
  assert.equal(registration.id, 'dsh-remote-aliyun');
  const descriptor = registration.factory(name => { assert.equal(name, 'react'); return {createElement(){}}; });
  assert.equal(typeof descriptor.apply, 'function');
  const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(metadata.dsh.client.platform, 'web'); assert.equal(metadata.exports['./client'], './client/index.js');
  const entries=[],calls=[];
  const context={connection:{rpc:{call:async(...args)=>{calls.push(args);return{ok:true,value:{protocolVersion:2,phase:'stopped',devices:[]}};}}},effect(){},slots:{inject:(name,fn)=>fn(),register:entry=>entries.push(entry)}};
  const scope={window:{__ModuleLoader__:{load:value=>{registration=value;}}},location:{protocol:'dsh-app:',hostname:'app'},AbortController,setInterval:()=>1,clearInterval(){}};
  vm.runInNewContext(source,scope);registration.factory(()=>({createElement(){}})).apply(context);
  assert.equal(entries[0].name,'settings.section');assert.equal(entries[0].id,'remote-control-aliyun');assert.equal(calls[0][2].action,'status');
  entries.length=0;calls.length=0;
  scope.location={protocol:'https:',hostname:'203.0.113.10'};
  registration.factory(()=>({createElement(){}})).apply(context);
  assert.equal(entries[0].name,'shell.overlay');assert.equal(entries[0].id,'dsh-remote-mobile');assert.equal(calls.length,0,'public UI must not call the local control API');
});
