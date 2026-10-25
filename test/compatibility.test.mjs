import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {isDesktopVersion,inspectDesktopRuntime,PLUGIN_VERSION} from '../src/compatibility.mjs';
import {apply} from '../src/plugin.mjs';
import {loadPrivateState,validatePrivateState} from '../src/state.mjs';
import {temporary} from './helpers.mjs';

function host() {
  return {get:key=>key==='profileContext'?{name:'desktop'}:undefined,
    webServer:{port:12345,protocol:'http:'},effect:()=>{},
    connection:{fetch:{register:()=>{}},authenticatedUrl:origin=>origin+'/?token=fixture-bootstrap'}};
}

test('Desktop updates use runtime capabilities and truthful version metadata',()=>{
  assert.equal(inspectDesktopRuntime(host(),'0.2.1-rc.2','0.2.1-rc.3').version,'0.2.1-rc.3');
  assert.equal(inspectDesktopRuntime(host(),undefined,'0.2.1-rc.3').tested,true);
  assert.equal(inspectDesktopRuntime(host(),undefined,'0.2.2').tested,false);
  assert.equal(inspectDesktopRuntime(host(),'0.2.1-rc.2',undefined).version,'0.2.1-rc.2');
  for(const version of [undefined,null,123,'','0.2','0.2.1\n','0.2.1/path','0.2.1?token=secret','x'.repeat(129)]) {
    assert.equal(isDesktopVersion(version),false);
    assert.throws(()=>inspectDesktopRuntime(host(),undefined,version),/valid runtime version/);
  }
});

test('missing Host APIs fail before publishing credentials or starting a gateway',async()=>{
  for(const ctx of [ {...host(),connection:{}}, {...host(),webServer:{port:0,protocol:'http:'}}, {...host(),effect:undefined} ]) {
    assert.throws(()=>inspectDesktopRuntime(ctx,undefined,'0.2.1-rc.3'),/missing required plugin APIs/);
  }
  const previous=process.env.DSH_CLIENT_VERSION;
  process.env.DSH_CLIENT_VERSION='0.2.1-rc.3';
  try {
    await assert.rejects(apply({...host(),connection:{}}),/connection.authenticatedUrl/);
  } finally {if(previous===undefined)delete process.env.DSH_CLIENT_VERSION;else process.env.DSH_CLIENT_VERSION=previous;}
});

for(const version of ['0.2.1-rc.2','0.2.1-rc.3']) test(`native plugin loads Desktop ${version}, publishes usable state and disposes it`,async()=>{
  const directory=await temporary('desktop-compatibility-');
  const previous=process.env.DSH_CLIENT_VERSION;
  const disposers=[],routes=[];
  process.env.DSH_CLIENT_VERSION=version;
  const ctx={...host(),logger:{info:()=>{}},effect:factory=>disposers.push(factory())};
  ctx.connection.fetch.register=route=>routes.push(route);
  try {
    await apply(ctx,{stateDirectory:path.join(directory,'instance'),gatewayStateDirectory:path.join(directory,'gateway'),verifiedVersion:'0.2.1-rc.2'});
    const state=await loadPrivateState(path.join(directory,'instance'));
    assert.equal(state.version,version);
    assert.equal(state.pluginVersion,PLUGIN_VERSION);
    assert.equal(state.compatibility.tested,true);
    const status=await(await routes.find(route=>route.path.endsWith('/status')).fetch()).json();
    assert.equal(status.version,version);
    assert.equal(JSON.stringify(status).includes('fixture-bootstrap'),false);
    assert.equal(validatePrivateState({...state,version:'0.2.2'}).version,'0.2.2');
    assert.throws(()=>validatePrivateState({...state,origin:'https://attacker.invalid'}),/127.0.0.1/);
    assert.throws(()=>validatePrivateState({...state,launchUrl:'https://attacker.invalid/?token=fixture'}),/bootstrap URL/);
    assert.ok((await readFile(path.join(directory,'instance','status.json'),'utf8')).includes(version));
    await disposers.pop()();
    await assert.rejects(readFile(path.join(directory,'instance','runtime.private.json')),{code:'ENOENT'});
  } finally {
    for(const dispose of disposers)await dispose();
    if(previous===undefined)delete process.env.DSH_CLIENT_VERSION;else process.env.DSH_CLIENT_VERSION=previous;
    await rm(directory,{recursive:true,force:true});
  }
});
