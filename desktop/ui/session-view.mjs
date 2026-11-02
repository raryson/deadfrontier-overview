const ids=['gained','rate','lost','net','base','elapsed'];
export class SessionView{
 constructor({api,context,navigate,action}){Object.assign(this,{api,context,navigate,action});this.page=0;this.id=null;this.revision='';this.busy=false;
 document.getElementById('session-back').onclick=()=>navigate('history',true);
 document.getElementById('session-prev').onclick=()=>this.open(this.id,Math.max(0,this.page-1));document.getElementById('session-next').onclick=()=>this.open(this.id,this.page+1);
 document.getElementById('review-close').onclick=()=>{this.review=null;document.getElementById('loot-review').hidden=true;};
 document.getElementById('review-alias-save').onchange=()=>document.getElementById('review-alias-from').disabled=!document.getElementById('review-alias-save').checked;
 document.getElementById('review-form').onsubmit=async event=>{event.preventDefault();const name=document.getElementById('review-item').value,definition=this.data.definitions.find(d=>d.name+' · '+d.itemId===name);if(!definition){document.getElementById('review-message').textContent=this.context().language.t('chooseCatalogItem');return;}
 const quantity=document.getElementById('review-quantity').value;if(await action('lootCorrect',{id:this.review.id,itemId:definition.itemId,quantity:quantity?Number(quantity):null,aliasFrom:document.getElementById('review-alias-save').checked?document.getElementById('review-alias-from').value:''})===false)return;
 this.review={...this.review,item:definition.name,quantity:definition.kind==='round'?(quantity?Number(quantity):undefined):1,status:'observed'};await this.open(this.id,this.page,this.review);document.getElementById('review-message').textContent=this.context().language.t('correctionSaved');};
 document.getElementById('review-ignore').onclick=async()=>{await action('lootIgnore',this.review.id);this.review=null;await this.open(this.id,this.page);};
 }
 image(entry){return 'dfov://app/loot-image/'+encodeURIComponent(entry.id)+'.jpg';}
 async open(id,page=0,review=null){this.id=id;this.page=page;this.review=review;document.getElementById('loot-review').hidden=!review;this.navigate('session');await this.load();if(review)this.showReview(review);}
 async load(){if(this.busy){this.reload=true;return;}this.busy=true;const id=this.id,page=this.page;try{const data=await this.api.session(id,page);if(this.id===id&&this.page===page){this.data=data;this.paint();}else this.reload=true;}catch(error){document.getElementById('session-period').textContent=error.message;}finally{this.busy=false;if(this.reload){this.reload=false;void this.load();}}}
 update(){if(!this.id||document.querySelector('[data-view="session"]').hidden)return;const {state}=this.context(),revision=[state.detailRevision,state.experience?.latest?.receivedAt,state.settings.language].join(':');if(revision!==this.revision&&!document.getElementById('loot-review').contains(document.activeElement)){this.revision=revision;void this.load();}}
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
 const options=this.data.definitions.map(d=>new Option(d.name+' · '+d.itemId));$('review-items').replaceChildren(...options);const current=this.data.definitions.find(d=>d.name===entry.item);$('review-item').value=current?current.name+' · '+current.itemId:'';$('review-quantity').value=entry.quantity??1;$('review-message').textContent='';
 if(scroll)$('loot-review').scrollIntoView({behavior:'smooth',block:'start'});
 }
}
