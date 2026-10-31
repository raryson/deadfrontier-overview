export function mountDesktopPrices(api,t,onError){
  const $=id=>document.getElementById(id);
  const request=async message=>{const result=await api.runtime.sendMessage(message);if(result.error)throw Error(result.error);return result.data;};
  async function refresh(){
    try{const state=await request({type:'desktopStatus'});
      $('price-pair-form').hidden=state.paired;$('price-unpair').hidden=!state.paired;
      $('price-sync').disabled=!state.paired;$('price-search-button').disabled=!state.paired;
      if(document.activeElement!==$('price-zone'))$('price-zone').value=state.zone;
      $('price-connection').textContent=t(!state.paired?'priceNotPaired':state.error??(state.online?'priceConnected':'priceWaitingApp'));
      $('price-last-sync').textContent=state.lastSync?t('priceLastSync',{time:new Date(state.lastSync).toLocaleString(),pending:state.pending}):t('priceNoSync');
    }catch(error){onError(t(error.message));}
  }
  $('price-pair-form').onsubmit=async event=>{
    event.preventDefault();
    try{
      const allowed=await api.permissions.request({origins:['http://127.0.0.1/*','https://fairview.deadfrontier.com/*']});
      if(!allowed)throw Error('pricePermissionRequired');
      await request({type:'desktopPair',code:$('price-pair-code').value.trim()});$('price-pair-code').value='';await refresh();
      request({type:'desktopSync'}).then(refresh).catch(error=>onError(t(error.message)));
    }catch(error){onError(t(error.message));}
  };
  $('price-unpair').onclick=async()=>{try{await request({type:'desktopDisconnect'});await refresh();}catch(error){onError(t(error.message));}};
  $('price-sync').onclick=async()=>{const button=$('price-sync');button.disabled=true;try{await request({type:'desktopSync'});await refresh();}catch(error){onError(t(error.message));}finally{button.disabled=false;}};
  $('price-search-form').onsubmit=async event=>{event.preventDefault();const button=$('price-search-button');button.disabled=true;try{const state=await request({type:'desktopQuote',name:$('price-name').value.trim(),custom:$('price-custom-equipment').checked});$('price-query-result').textContent=t('priceSearchDone',{count:state.offers});await refresh();}catch(error){onError(t(error.message));}finally{button.disabled=false;}};
  $('price-zone-form').onsubmit=async event=>{event.preventDefault();try{await request({type:'desktopZone',zone:$('price-zone').value});await refresh();}catch(error){onError(t(error.message));}};
  api.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.desktopSync||changes.language))refresh();});
  refresh();
}
