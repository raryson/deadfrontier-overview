export function sourceForWindow(sources,window) {
  return sources.find(source=>/^window:\d+:\d+$/.test(source.id)&&source.id.split(':')[1]===String(window.handle))??null;
}
export function selectGameWindow(windows,preferredTitle='') {
  const visible=windows.filter(window=>!window.minimized);
  if(visible.length===1)return visible[0];
  const preferred=visible.filter(window=>window.title===preferredTitle);
  return preferred.length===1?preferred[0]:null;
}
export function validRegion(value) {
  return value&&['x','y','width','height'].every(key=>Number.isFinite(value[key]))&&
    value.x>=0&&value.y>=0&&value.width>0&&value.height>0&&value.x+value.width<=1.001&&value.y+value.height<=1.001;
}
export function csvOfSessions(sessions) {
  const columns=['startedAt','endedAt','elapsed','gained','perHour','baseGained','basePerHour','lost','net','precision','basePartial','gap'];
  return '\uFEFF'+columns.join(',')+'\r\n'+sessions.map(entry=>columns.map(key=>{
    const value=entry[key];return typeof value==='boolean'?String(value):Number.isFinite(value)?String(value):'';
  }).join(',')).join('\r\n');
}
