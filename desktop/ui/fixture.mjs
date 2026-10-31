let xp=1000;function gain(){xp+=10;document.getElementById('hud').textContent=`LV. 12: ${new Intl.NumberFormat('en-US').format(xp)}K / 2,000K (${Math.round(xp/20)}%)`;}
document.getElementById('gain').onclick=gain;setInterval(gain,4000);

const loot=document.getElementById('fixture-loot');for(const id of ['fixture-yes','fixture-no','fixture-use'])document.getElementById(id).onclick=()=>{loot.hidden=true;};document.addEventListener('keydown',event=>{if(['e','t','c'].includes(event.key.toLowerCase()))loot.hidden=true;});

function layoutLoot(){const s=Math.min(innerWidth/1920,innerHeight/1080);loot.style.transform='scale('+s+')';loot.style.transformOrigin='top left';loot.style.left=(innerWidth/2-155*s)+'px';loot.style.top=(innerHeight/2-100*s)+'px';}layoutLoot();addEventListener('resize',layoutLoot);

function nextSearch(){const search=document.getElementById('fixture-search');search.hidden=false;setTimeout(()=>{search.hidden=true;loot.hidden=false;},9000);}for(const id of ['fixture-yes','fixture-no','fixture-use'])document.getElementById(id).addEventListener('click',nextSearch);document.addEventListener('keydown',event=>{if(['e','t','c'].includes(event.key.toLowerCase()))nextSearch();});
