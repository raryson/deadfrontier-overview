# Windows preview 0.3.1 — overlay e leitura de XP

- Restaura a prioridade da janela do overlay quando o client volta ao primeiro plano, sem tirar o foco do jogo.
- Corrige a leitura de XP exata com alvo abreviado, como `669,855 / 6,100K (11%)`. O percentual visível diferencia esse formato de um sufixo perdido pelo OCR.
- Mantém a integração de preços com a extensão 0.9.0.

Validation: 78 shared/extension tests and 13 desktop tests passed. The user confirmed the overlay is visible again over the actual client. Exact XP parsing is covered by a regression test, including ambiguous and missing-suffix rejection.

## English

Restores overlay z-order when the game regains focus, without activating the overlay. Supports exact XP against an abbreviated target when the visible percentage disambiguates it from OCR suffix loss. Browser extension 0.9.0 remains compatible.

## Integração de preços da versão 0.3.0

Integração opcional com a extensão 0.9.0 por pareamento local.

- Equipamentos comuns usam Yard/NPC e não geram buscas de mercado.
- Customizados/GC/NGC exigem a seleção explícita da variante.
- Demais itens recebem o menor preço unitário observado, separado por zona.
- Dinheiro, estimativas e itens sem preço/quantidade aparecem no histórico, overlay e CSV.
- Os nomes originais dos itens são preservados.

Atualize a extensão e siga o guia docs/prices.md no repositório. Recarregue o inventário da cidade para sincronizar o catálogo. O OCR de loot permanece experimental; as estimativas só incluem escolhas aceitas e quantidades conhecidas. Nenhuma venda, compra ou operação bancária é executada pela sincronização.

Validation: 77 extension tests and 13 desktop tests, authenticated loopback integration with offline retry, public listing queries and UI validation using an isolated fictional profile. Live extraction of the game Yard catalog still requires reloading the updated extension in the user browser.

## English

Optional extension pairing syncs the game item catalog/Yard reference and public listing quotes to the Windows app. Ordinary equipment uses Yard; explicit custom/GC/NGC variants may use market quotes. Original item names are preserved. Estimates appear per loot/session, in the overlay and CSV. Update to extension 0.9.0 and follow docs/prices.md. Loot OCR remains experimental; no trades are executed.
