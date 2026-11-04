import test from 'node:test';import assert from 'node:assert/strict';
import {nativeWindowGeometry,captureViewports,hudStrokeRegions,lootReadRegions,LootLayoutSearch} from '../ui/capture-layout.mjs';
const raw={x:157,y:13,width:1606,height:1053,clientX:160,clientY:39,clientWidth:1600,clientHeight:1024},geometry=nativeWindowGeometry(raw);
test('windowed capture uses the actual 26px title bar and visible border instead of assuming 32px',()=>{
 assert.equal(geometry.top,26);assert.equal(geometry.left,3);
 const view=captureViewports(1602,1051,geometry)[0];assert.deepEqual(view,{x:1,y:26,width:1600,height:1024,pixelScale:1,native:true});
 const hud=hudStrokeRegions(1602,1051,geometry)[0];assert.equal(Math.round(hud.x*1602),1);assert.equal(Math.round(hud.y*1051),108);assert.equal(hud.scale,1);
 const loot=lootReadRegions(1602,1051,geometry).find(r=>r.scale===1);assert.equal(Math.round((loot.y+115/1051)*1051),538);
});
test('client-only, downscaled and full-window captures retain bounded crops and frame fallbacks',()=>{
 assert.equal(captureViewports(1600,1024,geometry)[0].y,0);
 for(const[w,h]of [[1606,1053],[1602,1051],[1600,1024],[803,527]]){
  for(const area of [...hudStrokeRegions(w,h,geometry),...lootReadRegions(w,h,geometry)]){assert.ok(area.x>=0&&area.y>=0);assert.ok(area.x+area.width<=1.001&&area.y+area.height<=1.001);}
  assert.ok(hudStrokeRegions(w,h,geometry).some(r=>r.native===false));
 }
 const leftMonitor=nativeWindowGeometry({...raw,x:raw.x-1920,clientX:raw.clientX-1920});assert.deepEqual(leftMonitor,geometry);
 assert.equal(nativeWindowGeometry({...raw,clientWidth:NaN}),null);
 const noInsets=nativeWindowGeometry({x:0,y:0,width:1600,height:1000,clientX:0,clientY:0,clientWidth:1600,clientHeight:1000});assert.ok(hudStrokeRegions(1600,1000,noInsets).some(r=>!r.native&&Math.round(r.y*1000)===114));
});
test('a chrome/DPI change invalidates the selected loot crop even if capture dimensions stay fixed',()=>{
 const search=new LootLayoutSearch();const selected=search.candidates(1602,1051,0,geometry)[0];search.found(selected);
 assert.equal(search.candidates(1602,1051,67,geometry)[0],selected);
 const changed={...geometry,top:30,clientHeight:1020};assert.notEqual(search.candidates(1602,1051,100,changed)[0],selected);
});
