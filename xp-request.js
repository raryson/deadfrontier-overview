// Read-only XP refresh while a session is running; no game/client modifications.
(() => {
  let busy=false;
  window.addEventListener('message', event => {
    if((event.source!==null && event.source!==window) || event.origin!==location.origin || event.data?.type!=='overview-xp-request') return;
    const {requestId}=event.data;
    if(typeof requestId!=='string' || !/^[a-zA-Z0-9-]{1,80}$/.test(requestId)) return;
    const reply=result=>window.postMessage({type:'overview-xp-result',requestId,...result},location.origin);
    if(busy || (typeof pageLock!=='undefined' && pageLock)) {reply({error:'Aguarde a operação atual do jogo terminar.'});return;}
    if(typeof userVars==='undefined' || ['sc','userID','password'].some(key=>userVars[key] == null || String(userVars[key])==='')) {reply({error:'Sessão indisponível. Entre no jogo e recarregue esta página.'});return;}
    busy=true;
    let finished=false;
    const finish=result=>{if(finished)return;finished=true;busy=false;reply(result);};
    const xhr=new XMLHttpRequest(); xhr.timeout=15000;
    xhr.addEventListener('load',()=>{
      try {
        const url=new URL(xhr.responseURL);
        if(xhr.status!==200 || url.origin!==location.origin || url.pathname!=='/onlinezombiemmo/get_values.php' || xhr.responseText.length>2000000) throw Error();
        const params=new URLSearchParams(xhr.responseText);
        if(params.has('status')) throw Error();
        const fields={};
        for(const key of ['df_exp','df_level','df_servertime']) fields[key]=params.get(key)??params.get(`DFSTATS_${key}`);
        const sample=overviewXpSample(fields,userVars,userVars.userID);
        if(!sample) throw Error();
        finish({sample});
      } catch {finish({error:'Não foi possível atualizar a XP salva no servidor.'});}
    });
    for(const name of ['error','timeout','abort']) xhr.addEventListener(name,()=>finish({error:'Não foi possível atualizar a XP salva no servidor.'}));
    const params={sc:userVars.sc,userID:userVars.userID,password:userVars.password};
    try {
      xhr.open('POST','/onlinezombiemmo/get_values.php'); xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded');
      xhr.send(typeof objectJoin==='function'?objectJoin(params):Object.entries(params).map(([key,value])=>`${key}=${value}`).join('&'));
    } catch {finish({error:'Não foi possível atualizar a XP salva no servidor.'});}
  });
})();
