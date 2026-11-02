import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {platformTarget} from '../desktop/platform.mjs';
const exec=promisify(execFile),root=path.resolve(import.meta.dirname,'..'),target=platformTarget();
if(target.platform==='win32')throw Error('Use package-desktop.ps1 on Windows.');
const metadata=JSON.parse(await fs.readFile(path.join(root,'desktop','package.json'),'utf8')),version=metadata.version;
if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Invalid version');
const source=path.join(root,'dist',target.folder,`DeadFrontier Overview-${target.platform}-${target.arch}`),dist=path.join(root,'dist');
async function check(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const filename=path.join(directory,entry.name);if(/\.(sqlite(?:-wal|-shm)?|db|har|log)$/i.test(entry.name)||entry.name==='.tmp')throw Error('Private runtime data in app package');if(entry.isDirectory())await check(filename);}}
await check(source);const files=[];
if(target.platform==='darwin'){
 const archive=`deadfrontier-overview-macos-${target.arch}-${version}.zip`;
 await exec('ditto',['-c','-k','--sequesterRsrc','--keepParent',path.join(source,'DeadFrontier Overview.app'),path.join(dist,archive)]);files.push(archive);
}else{
 const archive=`deadfrontier-overview-linux-x64-${version}.tar.gz`;
 await exec('tar',['-czf',path.join(dist,archive),'-C',path.dirname(source),path.basename(source)]);files.push(archive);
 const stage=path.join(root,'.tmp','deb-stage-'+Date.now()),app=path.join(stage,'opt','deadfrontier-overview');
 await fs.mkdir(app,{recursive:true});await fs.cp(source,app,{recursive:true});await fs.chmod(path.join(app,'chrome-sandbox'),0o4755);
 for(const dir of ['DEBIAN','usr/bin','usr/share/applications','usr/share/icons/hicolor/128x128/apps'])await fs.mkdir(path.join(stage,dir),{recursive:true});
 await fs.writeFile(path.join(stage,'DEBIAN','control'),`Package: deadfrontier-overview\nVersion: ${version}\nArchitecture: amd64\nMaintainer: DeadFrontier Overview contributors\nSection: games\nPriority: optional\nDepends: libc6 (>= 2.35), libstdc++6, libx11-6, libgtk-3-0, libnss3, libgbm1, libasound2 | libasound2t64, libxss1, libxtst6, libnotify4\nDescription: Local Dead Frontier XP and loot companion (experimental X11 support)\n`);
 await fs.writeFile(path.join(stage,'usr','bin','deadfrontier-overview'),'#!/bin/sh\nexec "/opt/deadfrontier-overview/DeadFrontier Overview" "$@"\n',{mode:0o755});
 await fs.writeFile(path.join(stage,'usr','share','applications','deadfrontier-overview.desktop'),'[Desktop Entry]\nType=Application\nName=DeadFrontier Overview\nExec=deadfrontier-overview\nIcon=deadfrontier-overview\nTerminal=false\nCategories=Game;Utility;\n');
 await fs.copyFile(path.join(root,'icon.png'),path.join(stage,'usr','share','icons','hicolor','128x128','apps','deadfrontier-overview.png'));
 const deb=`deadfrontier-overview-linux-x64-${version}.deb`;await exec('dpkg-deb',['--build','--root-owner-group',stage,path.join(dist,deb)]);files.push(deb);
}
const sums=[];for(const file of files){const bytes=await fs.readFile(path.join(dist,file));sums.push(crypto.createHash('sha256').update(bytes).digest('hex')+'  '+file);}
await fs.writeFile(path.join(dist,`${target.platform}-${target.arch}-SHA256SUMS.txt`),sums.join('\n')+'\n');console.log(files.map(file=>path.join(dist,file)).join('\n'));
