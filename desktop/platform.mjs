export function platformTarget(platform=process.platform,arch=process.arch){
 if(platform==='win32'&&arch==='x64')return{platform,arch,folder:'windows',helper:'DFWindowProbe.exe',label:'Windows x64'};
 if(platform==='linux'&&arch==='x64')return{platform,arch,folder:'linux',helper:'DFWindowProbe',label:'Linux x64 · X11'};
 if(platform==='darwin'&&['x64','arm64'].includes(arch))return{platform,arch,folder:'macos',helper:'DFWindowProbe',label:arch==='arm64'?'macOS · Apple Silicon':'macOS · Intel'};
 throw Error(`Unsupported platform: ${platform}/${arch}`);
}
