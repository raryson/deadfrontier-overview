const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('overview',Object.freeze({
  read:()=>ipcRenderer.invoke('overview:read'),
  session:(id,page=0)=>ipcRenderer.invoke('overview:session',{id,page}),
  review:id=>ipcRenderer.invoke('overview:review',{id}),
  action:(type,value)=>ipcRenderer.invoke('overview:action',{type,value}),
  subscribe:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('overview:state',listener);return()=>ipcRenderer.removeListener('overview:state',listener);}
}));
