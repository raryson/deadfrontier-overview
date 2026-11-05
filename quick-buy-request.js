// MAIN world: game authentication is used here, never sent to the extension.
(() => {
  const model = globalThis.DFOverviewQuick;
  let busy = false, searches = [], quote = null;
  const reply = (requestId, result) => window.postMessage({type:'overview-quick-result', requestId, ...result}, location.origin);
  const context = () => {
    if (typeof userVars === 'undefined' || typeof globalData === 'undefined' || !userVars.userID || !userVars.sc || !/^\d+$/.test(String(userVars.DFSTATS_df_tradezone))) throw Error('notReady');
    return {account:String(userVars.userID), zone:String(userVars.DFSTATS_df_tradezone)};
  };
  function request(endpoint, params) {
    return new Promise((resolve,reject) => {
      if (typeof hash !== 'function') {reject(Error('notReady'));return;}
      const body = Object.entries(params).map(([key,value]) => `${key}=${value}`).join('&');
      const xhr = new XMLHttpRequest();
      xhr.timeout=15000;
      xhr.addEventListener('load',()=>{
        try {
          const url = new URL(xhr.responseURL);
          if (xhr.status !== 200 || url.origin !== location.origin || url.pathname !== endpoint || !xhr.responseText || xhr.responseText.length>2000000 || xhr.responseText.trim().startsWith('<')) throw Error('uncertain');
          const result = new URLSearchParams(xhr.responseText);
          if (result.has('status') || result.has('error')) throw Error(result.get('error')==='missed'?'missed':'refused');
          resolve(result);
        } catch(error) {reject(error);}
      },{once:true});
      for (const event of ['error','abort','timeout']) xhr.addEventListener(event,()=>reject(Error('uncertain')),{once:true});
      xhr.open('POST',endpoint); xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
      xhr.send(`hash=${hash(body)}&${body}`);
    });
  }
  window.addEventListener('message',async event => {
    if ((event.source!==window && event.source!==null) || event.origin!==location.origin || event.data?.type!=='overview-quick-request') return;
    const {requestId,action,id,quoteId} = event.data;
    if (typeof requestId!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(requestId) || !['context','quote','buy'].includes(action)) return;
    let locked=false, owned=false;
    try {
      const current=context();
      if (action==='context') {
        reply(requestId,{ok:true,action,items:model.presets.map(item=>model.definition(item.id,globalData)).filter(Boolean)}); return;
      }
      if (busy || (typeof pageLock!=='undefined' && pageLock)) throw Error('busy');
      busy=true; owned=true;
      if (typeof pageLock!=='undefined') {pageLock=true;locked=true;}
      if (action==='quote') {
        quote=null;
        searches=searches.filter(time=>Date.now()-time<60000);
        if (searches.length>=6) throw Error('rateLimit');
        const item=model.definition(id,globalData);
        if (!item) throw Error('notReady');
        searches.push(Date.now());
        const params={pagetime:userVars.pagetime,tradezone:current.zone,searchname:item.name.slice(0,20),memID:'',profession:'',category:'',search:'trades',searchtype:'buyinglistitemname'};
        const result=await request('/onlinezombiemmo/trade_search.php',params);
        const offer=model.selectOffer(result,item,current.zone,current.account);
        if (!offer) throw Error('noStack');
        quote={...offer,...current,item,quoteId:crypto.randomUUID(),expiresAt:Date.now()+30000};
        reply(requestId,{ok:true,action,quote:{quoteId:quote.quoteId,id:item.id,name:item.name,quantity:item.quantity,price:offer.price,expiresAt:quote.expiresAt}});
      } else {
        const selected=quote; quote=null; // One attempt, including uncertain network outcomes.
        if (!selected || selected.quoteId!==quoteId || Date.now()>selected.expiresAt || current.account!==selected.account || current.zone!==selected.zone) throw Error('expired');
        if(!userVars.password || userVars.template_ID===undefined)throw Error('notReady');
        const cash=Number(userVars.DFSTATS_df_cash);
        if (!Number.isSafeInteger(cash) || cash<selected.price) throw Error('cash');
        const slots=Number(userVars.DFSTATS_df_invslots);
        if (!Number.isSafeInteger(slots) || slots<1 || slots>500 || !Array.from({length:slots+1},(_,i)=>userVars[`DFSTATS_df_inv${i}_type`]).some(value=>value==='')) throw Error('inventoryFull');
        const params={pagetime:userVars.pagetime,templateID:userVars.template_ID,sc:userVars.sc,creditsnum:'undefined',buynum:selected.tradeId,renameto:'undefined`undefined',expected_itemprice:selected.price,expected_itemtype2:'',expected_itemtype:'',itemnum2:0,itemnum:0,price:0,action:'newbuy',gv:21,userID:userVars.userID,password:userVars.password};
        const result=await request('/onlinezombiemmo/inventory_new.php',params);
        // Confirm both the new cash amount and the purchased item in returned inventory.
        const newCash=result.get('df_cash');
        const containsItem=[...result].some(([key,value])=>/^df_inv\d+_type$/.test(key) && value===selected.item.id);
        if (!/^\d+$/.test(newCash??'') || Number(newCash)!==cash-selected.price || !containsItem) throw Error('uncertain');
        for (const [key,value] of result) if (/^df_[a-zA-Z0-9_]+$/.test(key)) userVars[`DFSTATS_${key}`]=value;
        try {
          if (document.getElementById('inventoryholder') && typeof populateInventory==='function') populateInventory();
          if (typeof updateAllFields==='function') updateAllFields();
        } catch { /* Purchase is confirmed even if the current page has no inventory renderer. */ }
        reply(requestId,{ok:true,action,cash:Number(newCash),name:selected.item.name,quantity:selected.quantity,price:selected.price});
      }
    } catch(error) {
      const codes=['notReady','busy','rateLimit','noStack','expired','cash','inventoryFull','missed','refused','invalidResponse'];
      reply(requestId,{ok:false,action,error:codes.includes(error.message)?error.message:'uncertain'});
    } finally {if(locked)pageLock=false;if(owned)busy=false;}
  });
})();
