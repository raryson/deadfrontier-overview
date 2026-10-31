// MAIN world: only public item definitions and the game's read-only Yard formula.
(()=>{
  let attempts=0;const timer=setInterval(()=>{
    if(++attempts>60){clearInterval(timer);return;}
    if(typeof globalData==='undefined'||typeof scrapValue!=='function')return;
    const items=[];
    for(const [itemId,data]of Object.entries(globalData)){
      if(!/^[a-zA-Z0-9_.:-]{1,100}$/.test(itemId)||!data||typeof data.name!=='string'||!data.name.trim()||data.name.length>120)continue;
      const truthy=value=>value===true||value===1||value==='1';
      const equipment=['weapon','armour','backpack'].includes(data.itemtype)||truthy(data.implant)||Boolean(data.clothingtype);
      const kind=equipment?'equipment':data.itemtype==='ammo'?'round':data.itemtype==='item'?'item':'unknown';
      const item={itemId,name:data.name,kind};
      if(equipment)try{const value=Number(scrapValue(itemId,1));if(Number.isSafeInteger(value)&&value>=0&&value<=1e12)item.yardValue=value;}catch{}
      items.push(item);if(items.length>=10000)break;
    }
    if(!items.length)return;
    const observedAt=Date.now();for(let i=0;i<items.length;i+=500)window.postMessage({type:'overview-item-catalog',snapshot:{version:1,observedAt,items:items.slice(i,i+500)}},location.origin);
    clearInterval(timer);
  },1000);
})();
