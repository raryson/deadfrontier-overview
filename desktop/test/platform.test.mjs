import test from 'node:test';import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';import path from 'node:path';import fs from 'node:fs';
import {platformTarget} from '../platform.mjs';import {sourceForWindow} from '../selection.mjs';
test('supported native targets use matching helpers and reject unbuilt platform/architecture pairs',()=>{
 assert.equal(platformTarget('win32','x64').helper,'DFWindowProbe.exe');assert.equal(platformTarget('linux','x64').helper,'DFWindowProbe');
 assert.equal(platformTarget('darwin','arm64').folder,'macos');assert.equal(platformTarget('darwin','x64').label,'macOS · Intel');
 assert.throws(()=>platformTarget('linux','arm64'));assert.throws(()=>platformTarget('freebsd','x64'));
 const sources=[{id:'window:123:0'},{id:'window:456:0'}];assert.equal(sourceForWindow(sources,{handle:'456'}),sources[1]);assert.equal(sourceForWindow(sources,{handle:'789'}),null);
});
test('the compiled Unix detector passes its native matching tests',{skip:process.platform==='win32'||!fs.existsSync(path.resolve('bin/DFWindowProbe'))},()=>{
 assert.equal(JSON.parse(execFileSync(path.resolve('bin/DFWindowProbe'),['--self-test'],{encoding:'utf8'})).ok,true);
});
