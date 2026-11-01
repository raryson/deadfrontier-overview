# DeadFrontier Overview — Windows

Prévia **0.7.0** do aplicativo desktop. O addon da cidade continua separado e funcionando; esta etapa migra o acompanhamento de XP e sessões para uma aplicação Windows independente do navegador.

[Baixar o app Windows portátil](https://github.com/raryson/deadfrontier-overview/releases/download/desktop-v0.7.0/deadfrontier-overview-windows-0.7.0.zip)

## Usar a versão portátil

1. Extraia **todo** o ZIP do app para uma pasta fixa. Não execute apenas o EXE de dentro do arquivo compactado.
2. Execute `DeadFrontier Overview.exe` dentro da pasta extraída. Não precisa instalar Node.js nem um SDK.
3. Deixe **Acompanhar o jogo automaticamente** ligado e abra o client do Dead Frontier.
4. O app procura uma janela visível do processo do jogo e começa a captura local. A primeira leitura estável inicia a sessão automaticamente. Não há seletor de compartilhamento do navegador.
5. Deixe o app na bandeja enquanto joga. O overlay aparece quando a janela do jogo está em primeiro plano e permite clicar normalmente no jogo.

Fechar o painel mantém o app na bandeja. Para encerrar completamente, use **Sair do app** ou **Sair** no menu da bandeja. O app não se cadastra automaticamente na inicialização do Windows.

Atalhos: **Alt+Shift+D** abre/oculta o painel; **Alt+Shift+O** liga/desliga o overlay.

## Preços e loot

Em **Preços do mercado**, Secronom Bunker / Outposts é o padrão. Escolha outra região no próprio app. Não precisa de código, login ou navegador para consultar. Equipamentos comuns usam Yard/NPC; consumíveis e munição usam anúncios públicos. Gasoline usa ml. Para testar, consulte **Gasoline** manualmente e abra as referências. O app prepara cotações ao reconhecer os loots e soma o valor potencial dos itens identificados com quantidade conhecida. Veja o [guia de preços](../docs/prices.md).

## Navegação

O menu lateral abre uma tela por vez: **Visão geral**, **Loot ao vivo**, **Histórico de sessões**, **Preços do mercado**, **Associações** e **Preferências**. A visão geral reúne XP e atalhos para as outras telas. A página de associações lista os nomes já salvos; a integração opcional com a extensão fica em Preferências.

A última tela usada fica lembrada neste computador. Trocar de tela mantém o acompanhamento e os formulários; não reinicia a captura nem a sessão. A indicação de leitura permanece no rodapé do menu.

## Sessões e histórico

- A sessão inicia automaticamente na primeira referência estável; XP anterior não é contada como ganho.
- **Parar sessão** congela os totais. Leituras futuras continuam atualizando a XP atual, mas não retomam a medição.
- **Salvar e zerar sessão** preserva a anterior e abre outra na próxima referência estável.
- Fechar o jogo salva e encerra a sessão. Reabrir o client inicia outra automaticamente.
- O histórico usa SQLite no computador, preserva sessões ao fechar/reabrir o app e mostra os 100 registros mais recentes. Não há exclusão automática dos demais registros; o CSV permite consultar todos.
- XP base e base/h são estimadas pelo multiplicador efetivo informado. Períodos sem fator são marcados como base parcial. A precisão continua limitada pelo HUD: valores em K têm passos de aproximadamente 1.000 XP.

Dados normais ficam em `%APPDATA%\DeadFrontier Overview\overview.sqlite`. Para backup, encerre o app antes de copiar o banco. As sessões não são sincronizadas com outros navegadores/computadores. O histórico existente no addon permanece nele. O app consulta anúncios públicos diretamente; a conexão opcional com a extensão atualiza o catálogo; o histórico de sessões permanece local.

## Reconhecimento e calibração

O helper associa o identificador nativo da janela ao processo do client. Os nomes reconhecidos por padrão incluem `DeadFrontier`, `DeadFrontierClient`, `DeadFrontierWin` com sufixo numérico e `DFClient`. Se seu client tiver outro nome, informe-o uma vez em **Configurações e leitura**, sem `.exe`. Essa configuração fica salva.

Se houver vários clients abertos, escolha a janela na lista do app. A preferência de título fica salva para ajudar nas próximas partidas; se ela for ambígua, o app aguarda uma seleção em vez de capturar outra janela.

Se a linha de XP não for reconhecida, abra **Ajustar a área de XP**, atualize a prévia e arraste o retângulo em volta de **LV + XP atual / XP necessária**. As coordenadas ficam salvas para a mesma resolução. O app tenta automaticamente o HUD com e sem a altura da barra de título. Mudanças de resolução criam uma nova referência e preservam a sessão anterior.

O jogo precisa continuar renderizando a janela. Minimizar pode interromper os frames; o tempo da sessão inclui esse intervalo. O comportamento sobre tela cheia exclusiva depende do client e precisa ser validado nele. Prefira inicialmente modo janela ou sem bordas.

Esta prévia usa um perfil local de XP; não faz login no jogo nem identifica automaticamente troca de personagem. Ao trocar de personagem na mesma janela, use **Salvar e zerar sessão**. O loot é experimental. O catálogo Yard acompanha o app e os anúncios são consultados diretamente, sem navegador. Buffs vindos do addon e compra/banco ainda não estão implementados neste app.

## Loot em segundo plano (0.7.0)

A captura roda a até 30 quadros por segundo e seleciona pequenos recortes do diálogo para uma fila em memória. O OCR trabalha separado da leitura de XP: pode aceitar o item imediatamente ou segurar F. Não é preciso aguardar a leitura.

**Captura manual extra:** com a tela de item encontrado visível e o client em primeiro plano, pressione **Shift + F** uma vez e siga jogando. O overlay mostra “recorte enviado para OCR”. O atalho usa os quadros imediatamente anteriores ao comando, inclusive se F fechar o diálogo. Ele não bloqueia as teclas do jogo. A captura automática continua ligada; as duas usam o mesmo registro para não duplicar o item. O atalho não atua em outras janelas.

O histórico registra **itens identificados no diálogo**, sem verificar aceite ou entrada na mochila. O total é o valor potencial desses itens. Recortes repetidos do mesmo diálogo não criam novas linhas; dois diálogos separados do mesmo item contam separadamente. Quantidades duvidosas ficam editáveis e fora da estimativa. O catálogo corrige grafias próximas de munição apenas quando o calibre coincide e há uma única correspondência.

São até 24 diálogos pendentes, com no máximo três recortes de 350 × 310 por diálogo. A fila cheia aparece no painel; não há gravação de imagens em disco. Encerrar o app descarta recortes ainda não processados. Fechar só o painel mantém o processamento na bandeja.

Telas pretas de carregamento mostram “Aguardando o HUD” ou “Carregando mapa”. Não iniciam uma sessão nem geram XP. A sessão começa na primeira leitura estável, aceitando XP exata sem K no início do nível.

## Privacidade

Apenas a janela do processo associado é usada como fonte de vídeo. A enumeração do Electron pede metadados sem thumbnails para evitar prévias de outras janelas; a seleção do stream usa o HWND validado pelo helper. Não há áudio, gravação de vídeo, upload, analytics, interceptação de tráfego, leitura de memória ou injeção no executável do jogo.

Frames e prévias ficam na memória. O banco contém configurações, leituras numéricas e sessões. O OCR, modelo e WebAssembly vêm no app. O protocolo local serve somente os recursos permitidos da aplicação e as conexões de rede do renderer são bloqueadas. A aplicação não pede credenciais do jogo.

## Desenvolvimento e reprodução

Build em Windows x64, Node.js 24.14.1, npm 11.11.0. O helper é compilado com o `csc.exe` do .NET Framework presente no Windows e usa Win32 para enumerar as janelas. Dependências fixadas em `desktop/package-lock.json`.

```powershell
cd desktop
npm ci --ignore-scripts
node node_modules/electron/install.js
node build.mjs --probe-only
npm test
npm start
```

Para gerar a pasta portátil:

```powershell
npm run package
```

Resultado: `../dist/windows/DeadFrontier Overview-win32-x64/`. Todos os arquivos dessa pasta são necessários. `build.mjs` usa uma lista explícita de fontes/recursos; não inclui perfis, SQLite, arquivos privados, instalador do jogo nem `node_modules` de desenvolvimento.

`npm run demo` abre dados fictícios sem capturar outras aplicações. Para o teste completo de captura, `electron . --self-test` cria uma janela própria com um HUD fictício que avança a cada quatro segundos. O helper limita esse teste ao processo e título exatos da janela fictícia. Perfis de teste ficam separados dos dados normais; `--test-data CAMINHO_ABSOLUTO` pode definir uma pasta própria para testes. Este modo não deve ser usado para medir o jogo real.

O teste completo comprovou captura sem seletor, OCR, início automático, ganho contínuo, parar, zerar e salvamento ao fechar a janela fictícia. No client real do usuário, o processo `DeadFrontier` foi reconhecido, a leitura do HUD iniciou a sessão automaticamente e o usuário confirmou o overlay sobre o jogo. Outras resoluções, escalas de tela e comportamentos de tela cheia ainda precisam ser conferidos nas respectivas configurações.

Para diagnosticar o OCR localmente, inicie o executável com `--diagnostic-file CAMINHO_ABSOLUTO.json`. Esse modo opcional grava a última tentativa de texto do HUD, o texto reconhecido no diálogo de loot, confiança e estado da leitura; não grava imagens e não envia dados. O arquivo é atualizado no caminho escolhido e não é necessário no uso normal.

## English quick start

Extract the entire portable ZIP and run **DeadFrontier Overview.exe**. Leave automatic tracking enabled and open the game client. The app detects its window and starts a session on the first stable readout, without a browser sharing picker. Close minimizes to the tray; Quit exits. Alt+Shift+D toggles the dashboard and Alt+Shift+O toggles the overlay. Portuguese/English follow the selected language or system preferences.

Sessions stay locally in SQLite under the app's user-data folder. Stop freezes the session; Save and reset preserves it and starts another. Closing the game ends and saves the session. Base XP is an estimate; K values have about 1,000 XP precision. Windowed/borderless mode is recommended for initial validation. Loot OCR runs on a bounded queue of frozen dialog crops at up to 30 fps. Accept immediately or hold F: the app identifies items seen without waiting for acceptance. Totals show potential value, not confirmed inventory. Black loading screens wait for the HUD; exact XP without K is supported. Public prices and Yard references work without a browser or code; see the [price guide](../docs/prices.md).

## Preços e Yard

Veja [o guia de conexão com a extensão](../docs/prices.md). Equipamentos comuns usam a referência Yard/NPC do jogo; somente uma escolha explícita de variante customizada/GC/NGC usa anúncios. Nomes originais são preservados. Estimativas aparecem por loot, por sessão, no overlay e no CSV.

O painel tem navegação lateral, XP em destaque e loot antes do histórico. As cores permanecem em carvão, cobre/laranja e vermelho escuro. O overlay continua no canto inferior direito.

Para começar do zero, use Preferências → Limpar histórico. O app solicita confirmação e apaga sessões de XP e registros de loot, preservando preferências, pareamento, catálogo e preços. Também existe a opção local de manutenção --clear-history, que limpa esse histórico ao iniciar. Não há rota HTTP para apagar dados.
