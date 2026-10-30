import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertOcrEnvironment} from '../ocr-environment.js';
const manifest=JSON.parse(fs.readFileSync(new URL('../manifest.json',import.meta.url),'utf8'));
test('o manifesto publicado permite OCR local em WebAssembly',()=>{
  assert.doesNotThrow(()=>assertOcrEnvironment(manifest,manifest.version));
});
test('arquivos novos com manifesto antigo não iniciam a captura',()=>{
  assert.throws(()=>assertOcrEnvironment({...manifest,version:'0.3.3',content_security_policy:null},manifest.version),{code:'ocrReloadRequired'});
});
test('manifesto sem permissão de WASM gera diagnóstico antes de carregar o motor',()=>{
  for(const content_security_policy of [null,undefined,{extension_pages:"script-src 'self'; object-src 'self'"}]) {
    assert.throws(()=>assertOcrEnvironment({...manifest,content_security_policy},manifest.version),{code:'ocrPolicyMissing'});
  }
});
