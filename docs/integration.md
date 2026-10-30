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

O uso de Fresh Herbs e a leitura automática do buff foram conferidos na sessão de desenvolvimento. O usuário confirmou o funcionamento do banco rápido após o ajuste da inicialização bancária. A interface PT/EN foi revisada em uma prévia de 420 px com dados fictícios.

Os testes automatizados usam apenas identificadores, credenciais e saldos artificiais. Imagens publicadas mostram somente a prévia fictícia; capturas da conta e arquivos temporários são ignorados pelo Git.

A visibilidade do PiP sobre o client e o comportamento de instalação permanente ainda exigem validação adicional. O executável do jogo não é necessário ao addon e não é distribuído neste repositório.
