# Windows preview 0.3.0 — preços e Yard

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
