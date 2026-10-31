# Windows preview 0.2.0 — loot experimental

Extraia todo o ZIP e abra DeadFrontier Overview.exe. O leitor de XP permanece separado do leitor de loot.

- Histórico local de itens e dinheiro encontrados, associado à sessão de XP quando disponível.
- Observa Yes (E), No (T), Use (C) ou o clique nos respectivos botões, somente com o diálogo reconhecido e o jogo em primeiro plano.
- Aceito exige escolha observada e fechamento do diálogo. Ausência de confirmação fica separada e não é contada como coleta.
- Reconhece também diálogos já abertos ao iniciar o app. A indicação SEARCHING/LOOTING é auxiliar; uma busca não cria loot sozinha.
- SQLite conserva os registros; o painel mostra os últimos 200.

Prévia experimental: nomes dependem do OCR. Não confirma inventário pelo servidor, não estima preços nem quantidades de pilhas. O primeiro teste real identificou dinheiro, mas o clique ficou não confirmado. O fluxo completo de clique foi validado em uma janela fictícia. A mensagem de busca ainda depende de validação na interface real do jogo.

Apenas captura local da janela do client: sem áudio, gravação de imagens ou upload. O helper não injeta código nem envia comandos ao jogo. Histórico e configuração anteriores são preservados.

## English

Experimental loot history alongside the separate XP reader. Detects found items/cash, records the observed Yes/No/Use choice and waits for dialog dismissal. Uncertain outcomes are not counted. Accepted is an observed UI choice, not server-side inventory confirmation. Local SQLite storage, no screenshot recording or uploads. Names depend on OCR; pricing and stack quantities are not implemented. Real cash recognition and a complete fictional click flow were validated; real search-progress recognition still needs validation.
