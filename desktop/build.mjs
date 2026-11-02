import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {packager} from '@electron/packager';
const exec=promisify(execFile);
const directory=import.meta.dirname,root=path.dirname(directory);
export async function buildProbe(){
  if(process.platform!=='win32')throw Error('Build the Windows helper on Windows.');
  await fs.mkdir(path.join(directory,'bin'),{recursive:true});
  const compiler=path.join(process.env.WINDIR??'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
  await exec(compiler,['/nologo','/target:exe','/optimize+','/r:System.Web.Extensions.dll','/out:'+path.join(directory,'bin','DFWindowProbe.exe'),path.join(directory,'native','WindowProbe.cs'),path.join(directory,'native','SearchHoldTracker.cs')],{windowsHide:true});
}
await buildProbe();
if(process.argv.includes('--probe-only')){console.log('Compiled native window detector.');process.exit(0);}
const stage=path.join(root,'.tmp','desktop-stage-'+Date.now());
await fs.mkdir(path.join(stage,'desktop'),{recursive:true});
const modules=['main.mjs','store.mjs','tracker.mjs','client-session.mjs','loot-review.mjs','selection.mjs','price-bridge.mjs','market-client.mjs','preload.cjs','capture-preload.cjs'];
for(const file of modules)await fs.copyFile(path.join(directory,file),path.join(stage,'desktop',file));
for(const folder of ['ui','bin','data'])await fs.cp(path.join(directory,folder),path.join(stage,'desktop',folder),{recursive:true});
for(const file of ['experience.js','ocr-parser.js','i18n.js','market-prices.js','market-search.js','item-catalog.js','icon.png'])await fs.copyFile(path.join(root,file),path.join(stage,file));
await fs.mkdir(path.join(stage,'vendor'),{recursive:true});await fs.cp(path.join(root,'vendor','ocr'),path.join(stage,'vendor','ocr'),{recursive:true});
const metadata=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8'));
await fs.writeFile(path.join(stage,'package.json'),JSON.stringify({name:metadata.name,productName:metadata.productName,version:metadata.version,type:'module',main:'desktop/main.mjs',description:'Dead Frontier local Windows XP companion'}));
// Wrap the existing PNG in an ICO container without changing its pixels.
const png=await fs.readFile(path.join(root,'icon.png'));const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=128;ico[7]=128;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
const iconPath=path.join(stage,'app.ico');await fs.writeFile(iconPath,Buffer.concat([ico,png]));
const outputs=await packager({dir:stage,out:path.join(root,'dist','windows'),name:'DeadFrontier Overview',platform:'win32',arch:'x64',electronVersion:metadata.devDependencies.electron,overwrite:true,asar:false,icon:iconPath,prune:true,appCopyright:'DeadFrontier Overview contributors',download:{cacheRoot:path.join(root,'.tmp','electron-cache')},win32metadata:{CompanyName:'DeadFrontier Overview',FileDescription:'DeadFrontier Overview',ProductName:'DeadFrontier Overview'}});
console.log(outputs.join('\n'));
