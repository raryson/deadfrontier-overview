# Windows preview 0.3.4 — Yes em diálogos abertos por mais tempo

Corrige o descarte do clique quando o nome do loot foi reconhecido há mais de quatro segundos, embora o mesmo diálogo continuasse aberto. Uma comparação local dos pixels do nome mantém a leitura válida; o título sozinho ou uma falha de OCR não renovam o contexto. Nenhuma escolha é inferida sem Yes/No/Use observado.

Inclui as melhorias de quantidades e captura: Gasoline em ml, nomes separados das pilhas, normalização de registros antigos, recortes do mesmo quadro, observação antecipada de escolhas e prevenção de eventos duplicados por variações de grafia.

Validation: 79 shared/extension tests and 24 desktop tests. The actual-client Yes reached the previous build but was rejected by the freshness guard. The corrected long-open path and rejection of stale/changed contexts pass regression tests; a second automatic live pickup has not yet been validated. The user's confirmed 880-round test pickup was restored locally with explicit user-confirmed evidence. No user history, diagnostic images or account data is included in the package.

## English

Keeps a recognized loot item fresh while a local pixel comparison confirms that the same name remains visible. Fixes rejected clicks on long-open dialogs without inferring pickups from title-only or missing OCR. Includes stack quantity parsing, Gasoline ml pricing and duplicate-event protection. Automatic live validation of the new path remains pending; the previous failed test pickup was restored using the user's explicit confirmation.

Recuperação manual: confirme uma coleta incerta e ajuste a quantidade na própria linha. O estado mostra Confirmado pelo usuário e permite desfazer. Essa ação só corrige o histórico local; não envia comandos ao jogo.
