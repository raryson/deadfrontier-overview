const ids=['gained','rate','lost','net','base','elapsed'];
export class SessionView{
 constructor({api,context,navigate,action}){Object.assign(this,{api,context,navigate,action});this.page=0;this.id=null;this.revision='';this.busy=false;
 document.getElementById('session-back').onclick=()=>navigate('history',true);
 document.getElementById('session-prev').onclick=()=>this.open(this.id,Math.max(0,this.page-1));document.getElementById('session-next').onclick=()=>this.open(this.id,this.page+1);
 document.getElementById('review-close').onclick=()=>this.closeReview();
 document.getElementById('loot-review').addEventListener('cancel',event=>{event.preventDefault();this.closeReview();});
 document.getElementById('session-review-start').onclick=()=>this.startBatch();
 document.getElementById('session-price-sync').onclick=()=>action('priceRefresh',{sessionId:this.id});
 document.getElementById('review-kind').onchange=()=>this.reviewKind();
 document.getElementById('review-skip').onclick=()=>this.completeReview('skipped');
 document.getElementById('review-alias-save').onchange=()=>document.getElementById('review-alias-from').disabled=!document.getElementById('review-alias-save').checked;
 document.getElementById('review-form').onsubmit=event=>{event.preventDefault();void this.saveReview();};
 document.getElementById('review-ignore').onclick=()=>this.completeReview('ignored');
 }
 closeReview(){const dialog=document.getElementById('loot-review');if(dialog.open)dialog.close();dialog.hidden=true;this.review=null;this.batch=null;this.reviewDefinitions=null;}
 reviewKind(){const cash=document.getElementById('review-kind').value==='cash';document.getElementById('review-cash-fields').hidden=!cash;document.getElementById('review-item-fields').hidden=cash;document.getElementById('review-item').required=!cash;document.getElementById('review-item').disabled=cash;document.getElementById('review-quantity').disabled=cash;document.getElementById('review-cash').required=cash;document.getElementById('review-cash').disabled=!cash;}
 async startBatch(){try{const data=await this.api.review(this.id);this.reviewDefinitions=data.definitions;this.batch={rows:data.rows,index:0,reviewed:0,ignored:0,skipped:0};if(!data.rows.length){this.batch=null;document.getElementById('session-review-message').textContent=this.context().language.t('noReviewPending');return;}this.showReview(data.rows[0]);}catch(error){document.getElementById('session-review-message').textContent=error.message;}}
 async saveReview(){const $=id=>document.getElementById(id),t=this.context().language.t;let ok;
 if($('review-kind').value==='cash')ok=await this.action('lootCash',{id:this.review.id,cash:Number($('review-cash').value)});
 else{const name=$('review-item').value,definition=(this.reviewDefinitions??this.data.definitions).find(d=>d.name+' · '+d.itemId===name);if(!definition){$('review-message').textContent=t('chooseCatalogItem');return;}const quantity=$('review-quantity').value;ok=await this.action('lootCorrect',{id:this.review.id,itemId:definition.itemId,quantity:quantity?Number(quantity):null,aliasFrom:$('review-alias-save').checked?$('review-alias-from').value:''});}
 if(ok===false){$('review-message').textContent=t('reviewSaveFailed');return;}await this.completeReview('reviewed');
 }
 async completeReview(result){if(result==='ignored'&&await this.action('lootIgnore',this.review.id)===false){document.getElementById('review-message').textContent=this.context().language.t('reviewSaveFailed');return;}
 const batch=this.batch;if(batch){batch[result]++;batch.index++;if(batch.index<batch.rows.length){this.showReview(batch.rows[batch.index]);return;}const text=this.context().language.t('reviewFinished',batch);this.closeReview();await this.load();document.getElementById('session-review-message').textContent=text;}
 else{this.closeReview();await this.load();document.getElementById('session-review-message').textContent=this.context().language.t(result==='ignored'?'ignored':'correctionSaved');}}
 image(entry){return 'dfov://app/loot-image/'+encodeURIComponent(entry.id)+'.jpg';}
 async open(id,page=0,review=null){this.closeReview();this.id=id;this.page=page;this.navigate('session');await this.load();if(review)this.showReview(review);}
 async load(){if(this.busy){this.reload=true;return;}this.busy=true;const id=this.id,page=this.page;try{const data=await this.api.session(id,page);if(this.id===id&&this.page===page){this.data=data;this.paint();}else this.reload=true;}catch(error){document.getElementById('session-period').textContent=error.message;}finally{this.busy=false;if(this.reload){this.reload=false;void this.load();}}}
 update(){if(!this.id||document.querySelector('[data-view="session"]').hidden||document.getElementById('loot-review').open)return;const {state}=this.context(),revision=[state.detailRevision,state.experience?.latest?.receivedAt,state.settings.language].join(':');if(revision!==this.revision){this.revision=revision;void this.load();}}
 paint(){const {language}=this.context(),t=language.t,$=id=>document.getElementById(id),data=this.data,session=data.session,fmt=n=>n==null?'—':new Intl.NumberFormat(language.locale,{maximumFractionDigits:0}).format(n),money=n=>'$'+new Intl.NumberFormat(language.locale,{maximumFractionDigits:2}).format(n),date=n=>n?new Date(n).toLocaleString(language.locale):t('unassignedLoot');
 $('session-name').textContent=session.id==='unassigned'?t('unassignedLoot'):date(session.startedAt);
 $('session-period').textContent=session.id==='unassigned'?t('unassignedLoot'):date(session.startedAt)+' → '+(session.running?t('running'):date(session.endedAt));
 const duration=n=>{const s=Math.floor((n??0)/1000);return[Math.floor(s/3600),Math.floor(s/60)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');};
 const values=[session.gained,session.perHour,session.lost,session.net??(session.gained??0)-(session.lost??0),session.baseAvailable?session.baseGained:null,duration(session.elapsed)];ids.forEach((id,i)=>$('detail-'+id).textContent=i===5?values[i]:fmt(values[i]));
 $('session-value').textContent=money((data.totals?.cash??0)+(data.totals?.estimated??0));$('session-total').textContent=t('sessionCaptures',{count:fmt(data.total)});
 $('session-page').textContent=t('pageOf',{page:data.page+1,total:Math.max(1,Math.ceil(data.total/data.pageSize))});$('session-prev').disabled=data.page===0;$('session-next').disabled=(data.page+1)*data.pageSize>=data.total;
 $('session-loot-rows').replaceChildren(...data.rows.map(entry=>{const row=document.createElement('tr');
 for(const value of [date(entry.foundAt),entry.item||t(entry.status),entry.quantity?fmt(entry.quantity)+(entry.unit==='ml'?' ml':' ×'):'—',t(entry.status),entry.valuation?.value!=null?money(entry.valuation.value):t('priceReason_'+(entry.valuation?.reason??'noQuote'))]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
 const imageCell=document.createElement('td');if(entry.hasImage){const image=document.createElement('img');image.src=this.image(entry);image.alt=t('lootImage');image.loading='lazy';image.className='loot-thumb';image.onclick=()=>this.showReview(entry);imageCell.append(image);}else imageCell.textContent='—';row.insertBefore(imageCell,row.children[1]);
 const action=document.createElement('td'),button=document.createElement('button');button.textContent=t('reviewLoot');button.onclick=()=>this.showReview(entry);action.append(button);row.append(action);return row;}));

 }
 showReview(entry,scroll=true){this.review=entry;const {language}=this.context(),t=language.t,$=id=>document.getElementById(id);$('loot-review').hidden=false;$('review-image').hidden=!entry.hasImage;$('review-no-image').hidden=!!entry.hasImage;if(entry.hasImage)$('review-image').src=this.image(entry);
 $('review-ocr').textContent=entry.ocrText||entry.rawItem||entry.item||t('noOcrText');$('review-alias-from').value=entry.rawItem||entry.item||'';$('review-alias-save').checked=!!$('review-alias-from').value;$('review-alias-from').disabled=!$('review-alias-save').checked;
 const definitions=this.reviewDefinitions??this.data.definitions,options=definitions.map(d=>new Option(d.name+' · '+d.itemId));$('review-items').replaceChildren(...options);const current=definitions.find(d=>d.name===entry.item);$('review-item').value=current?current.name+' · '+current.itemId:'';$('review-quantity').value=entry.quantity??1;$('review-message').textContent='';
 $('review-kind').value=entry.cash?'cash':'item';$('review-cash').value=entry.cash??'';this.reviewKind();$('review-skip').hidden=!this.batch;$('review-progress').textContent=this.batch?t('reviewProgress',{current:this.batch.index+1,total:this.batch.rows.length}):'';
 if(!$('loot-review').open)$('loot-review').showModal();
 }
}
