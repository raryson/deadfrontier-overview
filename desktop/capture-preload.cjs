const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('captureBridge',Object.freeze({
  config:()=>ipcRenderer.invoke('capture:config'),
  sample:value=>ipcRenderer.send('capture:sample',value),
  status:value=>ipcRenderer.send('capture:status',value),
  preview:value=>ipcRenderer.send('capture:preview',value),
  subscribe:callback=>ipcRenderer.on('capture:update',(_event,value)=>callback(value))
}));
