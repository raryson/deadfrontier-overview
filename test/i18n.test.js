import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveLanguage, t, messages, effectLabel, translateMessage, localeFor } from '../i18n.js';
test('idioma automático respeita prioridades, variantes e alternativa em inglês', () => {
  assert.equal(resolveLanguage('auto',['pt-BR','en-US']),'pt');
  assert.equal(resolveLanguage('auto',['pt-PT']),'pt');
  assert.equal(resolveLanguage('auto',['en-GB','pt-BR']),'en');
  assert.equal(resolveLanguage('auto',['fr-FR','pt-BR']),'pt');
  assert.equal(resolveLanguage('auto',['ja-JP']),'en');
  assert.equal(resolveLanguage('auto',[]),'en');
});
test('escolha manual prevalece sobre idioma do navegador e auto permite segui-lo novamente', () => {
  assert.equal(resolveLanguage('en',['pt-BR']),'en');
  assert.equal(resolveLanguage('pt',['en-US']),'pt');
  assert.equal(resolveLanguage('auto',['en-US']),'en');
  assert.equal(localeFor('pt'),'pt-BR');
});
test('todos os textos estáticos do painel têm versões PT e EN', () => {
  assert.deepEqual(Object.keys(messages.pt).sort(),Object.keys(messages.en).sort());
  const html=fs.readFileSync(new URL('../dashboard.html',import.meta.url),'utf8');
  for(const [,key] of html.matchAll(/data-i18n="([^"]+)"/g)) {
    assert.ok(messages.pt[key],`PT ausente: ${key}`);
    assert.ok(messages.en[key],`EN ausente: ${key}`);
  }
});
test('saldos, notificações e buffs EX usam os termos do idioma selecionado', () => {
  assert.equal(t('balances','en',{cash:'1,000',bank:'500'}),'Cash: $1,000 · Bank: $500');
  assert.equal(effectLabel('damage_ex','en'),'Damage EX +35%');
  assert.equal(effectLabel('speed','pt'),'Velocidade +35%');
  assert.equal(t('notification','en',{effect:effectLabel('exp','en')}),'The recorded timer for EXP +50% has expired.');
});
test('erros bancários são traduzidos sem alterar caminhos nem valores de diagnóstico', () => {
  assert.equal(translateMessage('Sessão indisponível. Entre no jogo e recarregue esta página.','en'),'Session unavailable. Sign in to the game and reload this page.');
  assert.equal(translateMessage('Não foi possível confirmar a operação [resposta redirecionada para /onlinezombiemmo/index.php]. Confira o saldo no jogo antes de repetir.','en'),'Unable to confirm the operation [response redirected to /onlinezombiemmo/index.php]. Check your in-game balance before trying again.');
});
