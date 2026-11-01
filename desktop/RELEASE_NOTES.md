# Windows preview 0.4.0 — captura antecipada e novo painel

- E/F mantido por um segundo antecipa a leitura, somente na janela escolhida e com acompanhamento ligado. O gesto de busca não conta como coleta.
- Atalhos e cliques são ligados ao quadro anterior à escolha. O OCR pode concluir depois que o diálogo fechar. E/T/C são reconhecidos; F só confirma Yes quando indicado no diálogo.
- Histórico temporário de até 12 recortes somente em memória; sem gravação ou upload.
- Navegação lateral, XP em destaque, loot antes das sessões e overlay mais compacto no canto inferior direito.
- Limpeza do histórico preserva preferências, conexão, catálogo e preços. A opção na interface solicita confirmação.

Validation: 79 shared/extension tests and 37 desktop tests, including compiled native hold-timing checks, stale/future-frame rejection, keyboard choices, duplicate suppression and history clearing. A complete native E-key pickup passed in an isolated fictional Electron client; the actual Dead Frontier client was not open for live validation. Loot OCR remains experimental.

## English

Holding E/F for one second primes loot recognition in the selected foreground game window. Search intent alone never creates a pickup. Keyboard/mouse choices are linked to a bounded memory-only frame captured before the choice, so OCR may finish after dismissal. Includes a redesigned sidebar dashboard and lower-right overlay. Clear history removes XP sessions and loot while preserving preferences and pricing configuration. Tested end-to-end using E in a fictional native client; real-client validation remains outstanding.
