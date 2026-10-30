# Integração

## Componentes

| Arquivo | Responsabilidade |
| --- | --- |
| `page-observer.js` | Observa XHR/fetch do jogo e extrai somente os campos permitidos de buffs. |
| `server-sync.js` | Valida os prazos, rejeita respostas antigas e mantém canais normais e EX separados. |
| `bank-request.js` | Prepara a inicialização bancária e envia consultas/movimentações solicitadas pelo jogador. |
| `content.js` | Insere o painel e faz a ponte entre a página e a extensão. |
| `background.js` | Serializa alterações de estado, persiste relógios e gerencia alarmes/notificações. |
| `dashboard.js` | Interface, idioma e vídeo local dos relógios para PiP. |
| `i18n.js` | Textos PT/EN, preferência de idioma e formatação. |
| `experience.js` | Sessão de XP, perdas, taxas e estimativas sem bônus por intervalo. |
| `capture-controller.js` | Captura autorizada por getDisplayMedia, recorte em memória e worker OCR local. |
| `ocr-parser.js` | Interpreta LV/XP, precisão e confirmação de leituras do HUD. |
| `xp-protocol.js` / `xp-request.js` | Extração limitada de XP e consulta somente de leitura a `get_values.php`. |

## Rotas observadas

Base: `https://fairview.deadfrontier.com/onlinezombiemmo/`.

| Tela | Rota | Elementos |
| --- | --- | --- |
| Cidade | `index.php` | Navegação da cidade |
| Banco | `index.php?page=15` | `#bankController`, `#deposit`, `#withdraw` |
| Inventário | `index.php?page=25` | `#inventoryholder`, `#sidebar` |
| Mercado | `index.php?page=35` | `#marketplace`, `#searchField`, `#itemDisplay` |

## Buffs

O código público do jogo compara os prazos `DFSTATS_df_boostexpuntil`, `DFSTATS_df_boostdamageuntil`, `DFSTATS_df_boostspeeduntil` e variantes `_ex` com `DFSTATS_df_servertime + 1200000000`. O sincronizador usa essa base temporal para calcular o tempo restante.

O observador aceita dados do estado inicial e respostas dos endpoints `inventory_new.php`, `get_values.php` e `bank.php`. Exige horário de servidor e pelo menos um prazo válido. Erros e respostas incompletas não geram um registro. A sincronização substitui os prazos; não soma duração a cada observação. Respostas antigas são descartadas, e mudar de personagem limpa os relógios anteriores.

Scripts MAIN compartilham o contexto com a página. Outros scripts do mesmo site podem interferir nos dados; os relógios são acompanhamento local, não uma prova independente do servidor.

## Banco

Consultas usam `get_values.php` sem parâmetros de depósito ou saque. Movimentações carregam `index.php?page=15` por GET em segundo plano e extraem somente o literal de inicialização `initBank`. O HTML e JavaScript recebidos não são executados. O personagem deve corresponder ao da página ativa.

O POST para `bank.php` segue a serialização do código nativo. A autenticação permanece no contexto da página e é enviada somente ao próprio jogo. A ponte recebe apenas resultados e saldos, sem credenciais.

Uma confirmação exige HTTP 200, endpoint final correspondente, ausência de status de erro e ambos os saldos válidos. Erros, redirecionamentos e timeout não causam reenvio automático. A interface recomenda consultar o saldo antes de repetir uma operação incerta.

## Validação e dados publicados

A cidade fornece XP salva, que não serve como fonte ao vivo do client separado. Desde 0.7, iniciar uma sessão exige captura visual autorizada pelo seletor getDisplayMedia em uma aba independente da extensão. O worker Tesseract e o modelo de idioma são locais e empacotados; a CSP permite WebAssembly local e bloqueia conexões externas. Não há áudio, upload, gravação, leitura de memória ou interceptação do executável.

O recorte da linha LV/XP recebe contraste e ampliação em canvas, com amostragem serial a cada ~2 s. O parser valida nível, XP e escala K/M/B. Duas leituras confirmam a referência inicial; perdas, saltos grandes e mudanças de nível exigem confirmação. Leituras antigas e de baixa confiança não geram ganhos. K tem precisão de 1.000 XP. A tabela de nível da cidade complementa a transição de nível; lacunas são sinalizadas. XP base usa o fator efetivo manual por intervalo.

Cada captura pertence à aba que a criou, com identificador aleatório de sessão; mensagens de outras abas não podem fornecer amostras. Captura ativa ignora amostras do servidor para não misturar precisões e fontes. Desde 0.8, a primeira amostra aceita inicia a sessão atomicamente no background e desarma o início pendente. Parar também desarma o início, para que amostras futuras não retomem a medição. Zerar salva a anterior e arma uma nova sessão para a próxima amostra. Trocar o recorte salva a sessão anterior, remove a referência e só rearma a medição se ela estava ativa.

`experienceHistory` fica separado do personagem mais recente e mantém até 100 registros identificados por sessão. Cada amostra salva atualiza o mesmo registro, sem duplicar linhas. Encerrar congela os campos e as taxas; leituras futuras não alteram um registro fechado. Fechar a aba ou atualizar encerra e salva; reiniciar o navegador encerra na última leitura salva para não incluir o tempo offline. Os registros legados ainda presentes podem ser preservados com identificador derivado de conta e início. Sessões antigas já descartadas não são recuperáveis. Só números de XP, métricas e coordenadas são persistidos, nunca frames ou texto bruto do OCR.

O OCR foi testado no navegador com um recorte privado do HUD; esse arquivo fica fora do Git. A escolha da janela e o acompanhamento contínuo no Firefox ainda precisam ser conferidos com o client aberto pelo usuário.

O pacote de instalação usa uma lista explícita de arquivos em `scripts/package.ps1`. A automação de release não usa credenciais da conta do jogo e recebe apenas o token efêmero do GitHub Actions para publicar os assets.

O uso de Fresh Herbs e a leitura automática do buff foram conferidos na sessão de desenvolvimento. O usuário confirmou o funcionamento do banco rápido após o ajuste da inicialização bancária. A interface PT/EN foi revisada em uma prévia de 420 px com dados fictícios.

Os testes automatizados usam apenas identificadores, credenciais e saldos artificiais. Imagens publicadas mostram somente a prévia fictícia; capturas da conta e arquivos temporários são ignorados pelo Git.

A visibilidade do PiP sobre o client e o comportamento de instalação permanente ainda exigem validação adicional. O executável do jogo não é necessário ao addon e não é distribuído neste repositório.
