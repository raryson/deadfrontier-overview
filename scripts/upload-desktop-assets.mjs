import fs from 'node:fs/promises';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {platformTarget} from '../desktop/platform.mjs';
const root=path.resolve(import.meta.dirname,'..'),target=platformTarget(),version=JSON.parse(await fs.readFile(path.join(root,'desktop','package.json'),'utf8')).version;
if(process.env.GITHUB_REF_NAME!==`desktop-v${version}`)throw Error('Tag/version mismatch');
const files=target.platform==='win32'?[`deadfrontier-overview-windows-${version}.zip`,'WINDOWS-SHA256SUMS.txt']:target.platform==='linux'?[`deadfrontier-overview-linux-x64-${version}.tar.gz`,`deadfrontier-overview-linux-x64-${version}.deb`,'linux-x64-SHA256SUMS.txt']:[`deadfrontier-overview-macos-${target.arch}-${version}.zip`,`darwin-${target.arch}-SHA256SUMS.txt`];
const paths=files.map(file=>path.join(root,'dist',file));for(const file of paths)await fs.access(file);
await promisify(execFile)('gh',['release','upload',process.env.GITHUB_REF_NAME,'--clobber',...paths]);console.log('Uploaded reviewed '+target.label+' assets to draft.');
