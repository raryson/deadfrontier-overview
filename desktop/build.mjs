import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {packager} from '@electron/packager';
import {platformTarget} from './platform.mjs';
const exec=promisify(execFile);
const directory=import.meta.dirname,root=path.dirname(directory);
const argument=name=>{const index=process.argv.indexOf(name);return index<0?null:process.argv[index+1];};
const target=platformTarget(argument('--platform')??process.platform,argument('--arch')??process.arch);
if(target.platform!==process.platform||target.arch!==process.arch)throw Error('Build each platform and architecture on a matching native runner.');
export async function buildProbe(){
  await fs.mkdir(path.join(directory,'bin'),{recursive:true});
  const output=path.join(directory,'bin',target.helper);
  if(target.platform==='win32'){
   const compiler=path.join(process.env.WINDIR??'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe');
   await exec(compiler,['/nologo','/target:exe','/optimize+','/r:System.Web.Extensions.dll','/out:'+output,path.join(directory,'native','WindowProbe.cs'),path.join(directory,'native','SearchHoldTracker.cs')],{windowsHide:true});
  }else if(target.platform==='darwin'){
   await exec('xcrun',['clang++','-std=c++17','-O2','-fobjc-arc','-mmacosx-version-min=14.0','-framework','AppKit','-framework','CoreGraphics',path.join(directory,'native','MacWindowProbe.mm'),'-o',output]);
  }else await exec('g++',['-std=c++17','-O2',path.join(directory,'native','LinuxWindowProbe.cpp'),'-lX11','-o',output]);
  if(target.platform!=='win32'){await fs.chmod(output,0o755);await exec(output,['--self-test']);}
}
await buildProbe();
if(process.argv.includes('--probe-only')){console.log('Compiled native window detector.');process.exit(0);}
const stage=path.join(root,'.tmp','desktop-stage-'+Date.now());
await fs.mkdir(path.join(stage,'desktop'),{recursive:true});
const modules=['main.mjs','platform.mjs','store.mjs','tracker.mjs','client-session.mjs','loot-review.mjs','selection.mjs','price-bridge.mjs','market-client.mjs','preload.cjs','capture-preload.cjs'];
for(const file of modules)await fs.copyFile(path.join(directory,file),path.join(stage,'desktop',file));
for(const folder of ['ui','data'])await fs.cp(path.join(directory,folder),path.join(stage,'desktop',folder),{recursive:true});
await fs.mkdir(path.join(stage,'desktop','bin'),{recursive:true});await fs.copyFile(path.join(directory,'bin',target.helper),path.join(stage,'desktop','bin',target.helper));
if(target.platform!=='win32')await fs.chmod(path.join(stage,'desktop','bin',target.helper),0o755);
for(const file of ['experience.js','ocr-parser.js','i18n.js','market-prices.js','market-search.js','item-catalog.js','icon.png'])await fs.copyFile(path.join(root,file),path.join(stage,file));
await fs.mkdir(path.join(stage,'vendor'),{recursive:true});await fs.cp(path.join(root,'vendor','ocr'),path.join(stage,'vendor','ocr'),{recursive:true});
const metadata=JSON.parse(await fs.readFile(path.join(directory,'package.json'),'utf8'));
await fs.writeFile(path.join(stage,'package.json'),JSON.stringify({name:metadata.name,productName:metadata.productName,version:metadata.version,type:'module',main:'desktop/main.mjs',description:'Dead Frontier local XP and loot companion'}));
// Wrap the existing PNG in an ICO container without changing its pixels.
const png=await fs.readFile(path.join(root,'icon.png'));const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=128;ico[7]=128;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
const iconPath=path.join(stage,'app.ico');await fs.writeFile(iconPath,Buffer.concat([ico,png]));
let targetIcon=target.platform==='win32'?iconPath:path.join(root,'icon.png');
if(target.platform==='darwin'){const header=Buffer.alloc(16);header.write('icns',0);header.writeUInt32BE(png.length+16,4);header.write('ic07',8);header.writeUInt32BE(png.length+8,12);targetIcon=path.join(stage,'app.icns');await fs.writeFile(targetIcon,Buffer.concat([header,png]));}
const outputs=await packager({dir:stage,out:path.join(root,'dist',target.folder),name:'DeadFrontier Overview',platform:target.platform,arch:target.arch,electronVersion:metadata.devDependencies.electron,overwrite:true,asar:false,icon:targetIcon,prune:true,appBundleId:'com.deadfrontieroverview.desktop',appCategoryType:'public.app-category.utilities',extendInfo:{NSHighResolutionCapable:true},appCopyright:'DeadFrontier Overview contributors',download:{cacheRoot:path.join(root,'.tmp','electron-cache')},win32metadata:{CompanyName:'DeadFrontier Overview',FileDescription:'DeadFrontier Overview',ProductName:'DeadFrontier Overview'}});
if(target.platform==='darwin')for(const output of outputs)await exec('codesign',['--force','--deep','--sign','-',path.join(output,'DeadFrontier Overview.app')]);
console.log(outputs.join('\n'));
