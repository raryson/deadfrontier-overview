# DeadFrontier Overview — Política de privacidade / Privacy policy

Atualizada em / Updated: 2026-10-30

## Português

DeadFrontier Overview é uma extensão independente para acompanhar a sessão do jogador em Dead Frontier. Não é um produto oficial do jogo.

**Dados usados e finalidade.** A extensão lê dados do jogo no domínio `fairview.deadfrontier.com`, incluindo identificador numérico do personagem, prazos de buffs, XP e saldos de moeda virtual. Usa esses dados para mostrar relógios, métricas e resultados das operações solicitadas pelo jogador. Preferências de idioma, configuração do recorte de OCR, multiplicador informado, métricas de sessão, relógios e cotações manuais são armazenados localmente no navegador. Os saldos exibidos no painel ficam em memória.

**Captura de janela.** A leitura de XP do client começa após uma ação do usuário e autorização no seletor de compartilhamento do navegador. A janela escolhida é processada localmente e um recorte do HUD é enviado ao worker local de OCR. A prévia e os frames ficam em memória: não são gravados nem enviados a servidores. Não há captura de áudio. O usuário pode encerrar pelo botão Parar captura, interrompendo o compartilhamento no navegador ou fechando a aba responsável. Valores numéricos de XP e coordenadas do recorte podem permanecer no armazenamento local.

**Autenticação e operações do jogo.** O usuário entra na conta diretamente pelo jogo. A extensão não pede nem armazena sua senha. As operações bancárias solicitadas pelo usuário reutilizam os dados de autenticação já presentes no contexto da página, enviando-os somente aos endpoints HTTPS do próprio jogo. A autenticação não é encaminhada ao painel nem persistida no armazenamento da extensão. A ponte entre a página e o painel retorna apenas campos limitados, como prazos, XP, resultados e saldos.

**Compartilhamento.** Não operamos um servidor para receber dados da extensão. Não há analytics, publicidade, venda de dados ou envio automático ao GitHub ou a outros terceiros. As comunicações necessárias às funções da cidade vão ao próprio jogo. Links externos, como a wiki e a página de suporte, só são abertos por ação do usuário e seguem as políticas dos respectivos serviços. Qualquer mensagem que o usuário publique voluntariamente em um issue do GitHub é pública e não deve incluir credenciais ou dados privados.

**Controle e retenção.** Dados locais permanecem até serem substituídos pelas funções do addon ou apagados pelo usuário. É possível parar ou zerar a sessão, excluir registros e cotações pelos controles disponíveis e remover os dados da extensão pelo navegador. A extensão não altera a política de armazenamento de dados da conta no servidor do jogo.

O histórico local mantém as últimas 100 sessões, incluindo o progresso da sessão atual, com datas, identificador do personagem, duração, XP, perdas e taxas estimadas. Parar ou zerar a sessão preserva o registro anterior. Ao superar 100 registros, as sessões mais antigas são removidas. O histórico não é enviado ao desenvolvedor nem sincronizado entre navegadores.

**Uso limitado.** Os dados tratados são usados somente para os recursos de acompanhamento e operações do jogo descritos ao usuário. Não são usados para anúncios, avaliação de crédito ou comercialização. O tratamento segue a Política de Dados do Usuário da Chrome Web Store, incluindo os requisitos de Uso Limitado.

**Contato.** Para dúvidas sobre privacidade: https://github.com/raryson/deadfrontier-overview/issues . Não publique senhas, cookies, tokens, capturas privadas ou arquivos HAR.

## English

DeadFrontier Overview is an independent extension for tracking a player's Dead Frontier session. It is not an official game product.

**Data and purpose.** The extension reads game data on `fairview.deadfrontier.com`, including the numeric character identifier, buff deadlines, XP and virtual currency balances. It uses these to display timers, metrics and the results of player-requested operations. Language preferences, OCR crop settings, the user-entered multiplier, session metrics, timers and manual price quotes are stored locally in the browser. Displayed balances stay in memory.

**Window capture.** Client XP reading starts after a user action and permission through the browser's sharing picker. The selected window is processed locally; a HUD crop is passed to the local OCR worker. Preview frames stay in memory, with no recording, server uploads or audio capture. Stop capture, end browser sharing or close the responsible tab to stop. Numeric XP values and crop coordinates may remain in local storage.

**Game authentication.** Users sign in directly through the game. The extension does not request or store passwords. Player-requested banking operations reuse authentication already present in the page context and send it only to the game's own HTTPS endpoints. Authentication is not forwarded to the dashboard or persisted in extension storage. The page/dashboard bridge returns limited fields such as deadlines, XP, operation results and balances.

**Sharing.** We operate no server that receives extension data. There is no analytics, advertising, sale of data or automatic upload to GitHub or other third parties. Outpost functions communicate with the game itself. External wiki/support links open only at the user's request and follow those services' policies. Information voluntarily posted in a GitHub issue is public; never include credentials or private data.

**Control and retention.** Local data remains until replaced by addon functions or deleted by the user. Available controls can stop/reset sessions and delete records/quotes. Users can remove extension data through their browser. This does not change the game's retention of account data on its own servers.

Local history retains the latest 100 sessions, including current progress, with dates, character identifier, duration, XP, losses and estimated rates. Stopping or resetting preserves the previous record. Oldest sessions are removed beyond 100 records. History is not sent to the developer or synchronized across browsers.

**Limited Use.** Data is used only for the disclosed game tracking and user-requested game operations. It is not used for advertising, credit evaluation or sale. Data handling follows the Chrome Web Store User Data Policy, including Limited Use requirements.

**Contact.** Privacy questions: https://github.com/raryson/deadfrontier-overview/issues . Do not post passwords, cookies, tokens, private captures or HAR files.
