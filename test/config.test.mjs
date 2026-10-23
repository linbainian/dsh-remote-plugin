import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {DesktopRemoteController} from '../src/desktop-controller.mjs';
import {temporary,gatewayConfig} from './helpers.mjs';

test('fresh native bundle loads without a shipped server configuration and persists setup outside the package',async()=>{
  const directory=await temporary('fresh-bundle-');let controller,restored,launches=0;
  try{
    controller=new DesktopRemoteController({directory,launch:()=>{launches++;throw new Error('must not start before setup');}});
    await controller.initialize();
    const initial=await controller.snapshot();
    assert.equal(initial.phase,'unconfigured');assert.equal(initial.configured,false);assert.equal(initial.link,null);
    await assert.rejects(controller.action({action:'start'}),/先填写/);assert.equal(controller.enabled,false);assert.equal(launches,0);
    const config=gatewayConfig(directory);
    await assert.rejects(controller.action({action:'configure',configuration:{...config,publicOrigin:'http://203.0.113.10'}}),/HTTPS/);
    await assert.rejects(controller.action({action:'configure',configuration:{...config,ssh:{...config.ssh,identityFile:'relative-key'}}}),/绝对路径/);
    const saved=await controller.action({action:'configure',configuration:config});
    assert.equal(saved.configured,true);assert.equal(saved.phase,'stopped');
    assert.equal(controller.configFile,path.join(directory,'config.private.json'));
    assert.deepEqual(JSON.parse(await readFile(controller.configFile)),config);
    restored=new DesktopRemoteController({directory});await restored.initialize();
    assert.equal((await restored.snapshot()).configuration.publicOrigin,config.publicOrigin);
    controller.probe=async()=>({protocolVersion:2,transport:{phase:'ready'}});
    await assert.rejects(controller.action({action:'configure',configuration:config}),/先停止/);
  }finally{if(controller)controller.enabled=false;await controller?.dispose();await restored?.dispose();await rm(directory,{recursive:true,force:true});}
});
