## Extensão 0.10.2

- Painel da cidade aberto por padrão, com banco e buffs no topo.
- Bossmap do DFProfiler com foco inicial na região leste. Os dois painéis laterais ajustam a largura até a moldura do jogo.
- Compras rápidas de stacks completas de munição e Gasoline, além de comida e medicina por unidade. Mostra quantidade e preço antes da confirmação; sem substituir automaticamente uma oferta vendida.
- Atalhos de saque de $10.000, $50.000 e $100.000, além de depósito total, saque total e consulta de saldo.
- Interface em português e inglês e guias de instalação atualizados.

Validação: 96 testes automatizados passando. A compra real pelos novos atalhos ainda precisa de validação; os testes do protocolo usam respostas simuladas.

Chrome: extraia `deadfrontier-overview-chrome.zip` e carregue a pasta em `chrome://extensions` com o modo do desenvolvedor ativo. Firefox: use `deadfrontier-overview.zip` em `about:debugging` (instalação temporária; este pacote não é assinado pela Mozilla).

Ao atualizar, recarregue a extensão e a página do jogo. O acesso adicional ao DFProfiler serve para ajustar o mapa incorporado e pode exigir aceitação no navegador. Carregar o mapa conecta diretamente ao serviço de terceiros; veja a política de privacidade no repositório.

O app desktop é distribuído separadamente e mantém sua própria versão.
