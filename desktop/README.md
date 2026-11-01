# DeadFrontier Overview — Windows

Prévia **0.5.0** do aplicativo desktop. O addon da cidade continua separado e funcionando; esta etapa migra o acompanhamento de XP e sessões para uma aplicação Windows independente do navegador.

[Baixar o app Windows portátil](https://github.com/raryson/deadfrontier-overview/releases/download/desktop-v0.5.0/deadfrontier-overview-windows-0.5.0.zip)

## Usar a versão portátil

1. Extraia **todo** o ZIP do app para uma pasta fixa. Não execute apenas o EXE de dentro do arquivo compactado.
2. Execute `DeadFrontier Overview.exe` dentro da pasta extraída. Não precisa instalar Node.js nem um SDK.
3. Deixe **Acompanhar o jogo automaticamente** ligado e abra o client do Dead Frontier.
4. O app procura uma janela visível do processo do jogo e começa a captura local. A primeira leitura estável inicia a sessão automaticamente. Não há seletor de compartilhamento do navegador.
5. Deixe o app na bandeja enquanto joga. O overlay aparece quando a janela do jogo está em primeiro plano e permite clicar normalmente no jogo.

Fechar o painel mantém o app na bandeja. Para encerrar completamente, use **Sair do app** ou **Sair** no menu da bandeja. O app não se cadastra automaticamente na inicialização do Windows.

Atalhos: **Alt+Shift+D** abre/oculta o painel; **Alt+Shift+O** liga/desliga o overlay.

## Preços e loot

Em **Preços do mercado**, Secronom Bunker / Outposts é o padrão. Escolha outra região no próprio app. Não precisa de código, login ou navegador para consultar. Equipamentos comuns usam Yard/NPC; consumíveis e munição usam anúncios públicos. Gasoline usa ml. Para testar, consulte **Gasoline** manualmente e abra as referências. O app prepara cotações ao reconhecer os loots e soma apenas coletas aceitas com quantidade conhecida. Veja o [guia de preços](../docs/prices.md).

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

Para diagnosticar o OCR localmente, inicie o executável com `--diagnostic-file CAMINHO_ABSOLUTO.json`. Esse modo opcional grava a última tentativa de texto do HUD, o diálogo de loot, confiança, estado e a categoria de clique/tecla da escolha dentro do jogo; não grava imagens e não envia dados. O arquivo é atualizado no caminho escolhido e não é necessário no uso normal.

## Loot experimental (0.2)

O app lê separadamente o diálogo central de item encontrado e registra nome, horário, sessão de XP e escolha. Dinheiro encontrado também é identificado. O leitor funciona mesmo se o app for aberto com o diálogo já visível; a antecipação principal vem de E/F mantido por um segundo. SEARCHING/LOOTING continua sendo uma indicação auxiliar de busca, sem criar um item e sem exigir que a barra tenha sido observada.

Com o acompanhamento ligado e a janela exata do jogo em primeiro plano, o helper observa E/F mantido por um segundo para antecipar a busca. Durante essa antecipação ou um diálogo reconhecido, observa os atalhos E/F/T/C e o clique esquerdo. F só confirma Yes se esse atalho estiver indicado no diálogo. O quadro anterior à escolha fica temporariamente em memória para que o OCR possa terminar depois do fechamento. Não envia teclas, não clica pelo jogador, não instala hooks e não observa outras teclas ou aplicativos. A escolha só é finalizada após o diálogo desaparecer. Fechar o app, perder a captura ou não observar a escolha deixa o resultado não confirmado.

“Aceito (Yes)” indica a escolha observada na interface; não é uma confirmação de inventário vinda do servidor. Preços são referências estimadas; pilhas de quantidade desconhecida precisam de ajuste manual para entrar no total. Nomes dependem do OCR e podem conter erros. Use o recurso como histórico auxiliar. Cliques muito rápidos, teclas mantidas pressionadas, escalas de UI diferentes e diálogos breves podem não ser identificados. A tabela mostra os últimos 200 eventos; o banco mantém todos. A validação real inicial reconheceu dinheiro; o primeiro clique real ficou não confirmado. O caminho de clique completo foi validado com um item fictício no próprio app.

## English quick start

Extract the entire portable ZIP and run **DeadFrontier Overview.exe**. Leave automatic tracking enabled and open the game client. The app detects its window and starts a session on the first stable readout, without a browser sharing picker. Close minimizes to the tray; Quit exits. Alt+Shift+D toggles the dashboard and Alt+Shift+O toggles the overlay. Portuguese/English follow the selected language or system preferences.

Sessions stay locally in SQLite under the app's user-data folder. Stop freezes the session; Save and reset preserves it and starts another. Closing the game ends and saves the session. Base XP is an estimate; K values have about 1,000 XP precision. Windowed/borderless mode is recommended for initial validation. Loot tracking is experimental; accepted means an observed Yes choice followed by dialog dismissal, without server inventory confirmation. See the [price integration guide](../docs/prices.md) to pair the browser addon, synchronize market estimates and read the game's Yard references for ordinary equipment.

## Preços e Yard

Veja [o guia de conexão com a extensão](../docs/prices.md). Equipamentos comuns usam a referência Yard/NPC do jogo; somente uma escolha explícita de variante customizada/GC/NGC usa anúncios. Nomes originais são preservados. Estimativas aparecem por loot, por sessão, no overlay e no CSV.

## Leitura de loot na versão 0.5.0

O leitor separa nome e quantidade (Gasoline em ml), confirma números em leituras concordantes e mantém ajuste manual para pilhas. Registros antigos como GASOLINE (812 são normalizados preservando o texto original, a sessão e o estado de coleta. A detecção do título antecipa a observação de Yes/No/Use; nome e botões vêm de um único quadro. Uma falha de OCR não comprova fechamento do diálogo. O inventário final sozinho não permite reconstruir com certeza os itens perdidos de uma run passada, pois pode conter itens anteriores, consumidos ou vendidos.

## Captura antecipada e visual (0.5.0)

Segurar E ou F por pelo menos um segundo prepara a leitura por até 12 segundos. O gesto de busca não cria um item. O atalho ou clique é associado a um quadro do próprio diálogo capturado até 500 ms antes da escolha, evitando depender de a tela continuar parada. O pequeno histórico de quadros fica somente na memória e é limitado a 12 recortes; não há gravação ou upload. Falhas detectadas são indicadas no painel e ainda podem exigir correção manual.

O painel tem navegação lateral, XP em destaque e loot antes do histórico. As cores permanecem em carvão, cobre/laranja e vermelho escuro. O overlay continua no canto inferior direito.

Para começar do zero, use Preferências → Limpar histórico. O app solicita confirmação e apaga sessões de XP e registros de loot, preservando preferências, pareamento, catálogo e preços. Também existe a opção local de manutenção --clear-history, que limpa esse histórico ao iniciar. Não há rota HTTP para apagar dados.
