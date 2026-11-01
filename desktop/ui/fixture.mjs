let xp=1000;function gain(){xp+=10;document.getElementById('hud').textContent=`LV. 12: ${new Intl.NumberFormat('en-US').format(xp)}K / 2,000K (${Math.round(xp/20)}%)`;}
document.getElementById('gain').onclick=gain;const gainTimer=setInterval(gain,4000);

const loot=document.getElementById('fixture-loot');for(const id of ['fixture-yes','fixture-no','fixture-use'])document.getElementById(id).onclick=()=>{loot.hidden=true;};document.addEventListener('keydown',event=>{if(['e','t','c'].includes(event.key.toLowerCase()))loot.hidden=true;});

function layoutLoot(){const s=Math.min(innerWidth/1920,innerHeight/1080);loot.style.transform='scale('+s+')';loot.style.transformOrigin='top left';loot.style.left=(innerWidth/2-155*s)+'px';loot.style.top=(innerHeight/2-100*s)+'px';}layoutLoot();addEventListener('resize',layoutLoot);

function nextSearch(){const search=document.getElementById('fixture-search');search.hidden=false;setTimeout(()=>{search.hidden=true;loot.hidden=false;},9000);}for(const id of ['fixture-yes','fixture-no','fixture-use'])document.getElementById(id).addEventListener('click',nextSearch);document.addEventListener('keydown',event=>{if(['e','t','c'].includes(event.key.toLowerCase()))nextSearch();});

if(new URL(location.href).searchParams.has('snapshots')){
 clearInterval(gainTimer);
 const hud=document.getElementById('hud');
 const black=on=>{document.body.style.background=on?'#000':'#293028';for(const child of document.body.children)if(child.tagName!=='SCRIPT')child.style.visibility=on?'hidden':'visible';};
 black(true);loot.hidden=true;setTimeout(()=>black(false),5000);
 let exact=12;setInterval(()=>{exact+=1000;hud.textContent='LV. 100: '+new Intl.NumberFormat('en-US').format(exact)+' / 6,100K ('+Math.floor(exact/6100000*100)+'%)';},1000);
 const flash=(name,at)=>setTimeout(()=>{loot.querySelector('p').textContent='YOU HAVE FOUND SOME '+name+'. WILL YOU TAKE IT?';loot.hidden=false;setTimeout(()=>loot.hidden=true,180);},at);
 flash('WHISKEY',7000);flash('12.7MM RIFLE BULLETS (880)',10000);flash('GASOLINE (812)',13000);flash('WHISKEY',16000);
 setTimeout(()=>black(true),19000);setTimeout(()=>black(false),21000);
}

if(new URL(location.href).searchParams.has('manual')){
 // Deliberately no title: automatic visual detection cannot select this card.
 loot.querySelector('div').textContent='';
 document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='f')loot.hidden=true;});
}
