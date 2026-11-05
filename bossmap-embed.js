// Runs only on the public provider page, never inside an extension page.
(() => {
  if (window.top===window || location.hash!=='#dfov-east') return;
  const page=document.getElementById('bossmap-page');if(!page)return;
  document.body.append(page);
  const style=document.createElement('style');
  style.textContent='html,body{margin:0!important;padding:0!important;background:#100e0c!important;min-width:0!important}body> :not(#bossmap-page):not(script):not(style){display:none!important}#bossmap-page{margin:0!important;padding:0!important;width:100%!important;max-width:none!important}#bossmap-page>*:not(#dfov-map-viewport){display:none!important}#dfov-map-viewport{margin:0!important;padding:0!important;width:100%!important;overflow:auto;height:100vh}#boss-table{margin:0!important}';
  document.head.append(style);
  const holder=document.createElement('div');holder.id='dfov-map-viewport';page.append(holder);
  let table;
  function east(){const next=document.getElementById('boss-table');if(!next||next===table)return;table=next;if(next.parentNode!==holder)holder.append(next);requestAnimationFrame(()=>{holder.scrollLeft=holder.scrollWidth-holder.clientWidth;});}
  new MutationObserver(east).observe(page,{childList:true,subtree:true});
  new ResizeObserver(()=>{holder.scrollLeft=holder.scrollWidth-holder.clientWidth;}).observe(holder);
  east();
})();
