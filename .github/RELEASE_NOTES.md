## Sessão automática e histórico 0.8.0 / Automatic sessions and history

Ao conectar a janela do client, a sessão começa na primeira leitura estável, sem outro clique. Parar mantém os resultados congelados; Nova sessão inicia outra medição. Zerar salva a anterior e começa outra na próxima leitura com captura ativa. As últimas 100 sessões e o progresso atual são salvos localmente, com tabela de XP, taxas, duração, personagem, perdas e estimativas de XP base. Fechar a captura ou reiniciar preserva as sessões salvas. Leituras futuras não reescrevem sessões encerradas.

Connecting the client window starts the session on the first stable readout. Stop freezes results; New session starts another measurement. Reset saves the previous session and starts another on the next readout with active capture. The latest 100 sessions and current progress are saved locally, with a table of XP, rates, duration, character, losses and estimated base XP. Ending capture or restarting preserves saved sessions. Later readings do not rewrite closed sessions.

## Diagnóstico de atualização 0.7.2 / Update diagnostics

O painel agora mostra a versão do manifesto realmente carregado pelo navegador. OCR verifica manifesto e permissão de WebAssembly antes de iniciar; arquivos novos com manifesto antigo recebem instruções de atualização. O selo Pronto só aparece após uma leitura válida. As etapas de carregamento do motor e do modelo são exibidas separadamente.

The panel now displays the manifest version actually loaded by the browser. OCR checks the manifest and WebAssembly permission before starting; mixed old/new installations receive update instructions. Ready is shown only after a valid readout. Engine and model loading stages are displayed separately.

**Atualização Firefox:** se instalou pelo ZIP, use Carregar extensão temporária e selecione o ZIP novo. Se usa uma pasta, substitua todos os arquivos incluindo manifest.json, clique Recarregar na extensão e feche as abas antigas do addon. Atualizar apenas a página do jogo não recarrega o manifesto.

**Firefox update:** when installed from a ZIP, use Load Temporary Add-on and select the new ZIP. For a folder, replace all files including manifest.json, reload the extension and close old add-on tabs. Reloading only the game page does not reload the manifest.

## Correção Firefox 0.7.1 / Firefox fix

Corrige `chrome.tabs is undefined` ao conectar o OCR ou abrir a janela flutuante pelo painel incorporado na cidade. A abertura da aba independente agora passa pelo processo de fundo da extensão. Recarregue a extensão **e a página do jogo** após atualizar.

Fixes `chrome.tabs is undefined` when connecting OCR or opening the floating window from the embedded outpost panel. The background process now opens the standalone tab. Reload both the extension and the game page after updating.

## Instalação / Installation

Baixe **deadfrontier-overview.zip**. No Firefox, selecione o ZIP diretamente em **Carregar extensão temporária**; no Chrome, extraia e use **Carregar sem compactação**. Veja **INSTALL.md**. O pacote contém somente o addon e o guia de instalação.

Download **deadfrontier-overview.zip**, extract it, and follow **INSTALL.md**. The package contains only the add-on and installation guide.

**Firefox:** instalação temporária via `about:debugging#/runtime/this-firefox`. Instalação permanente requer assinatura Mozilla; este ZIP ainda não é assinado.

**Firefox:** temporary installation through `about:debugging#/runtime/this-firefox`. Permanent installation requires Mozilla signing; this ZIP is not signed.

## XP no overlay / Overlay XP

Correção da fonte de XP: agora lê a linha LV/XP da janela do client por OCR local. Abra a extensão em uma aba independente, clique **Conectar janela do client**, selecione a janela do jogo e confira a prévia antes de iniciar a sessão. Se necessário, ajuste o recorte. Mantenha a aba aberta. Valores em K têm precisão aproximada de 1.000 XP. XP base e base/h continuam sendo estimativas pelo multiplicador efetivo informado.

Live XP now uses local OCR of the client's LV/XP line. Open the extension in its own tab, click **Connect client window**, choose the game window and verify the preview before starting. Adjust the crop if needed. Keep the tab open. K values have roughly 1,000 XP precision. Base XP and base/hour remain estimates based on your effective multiplier.

Frames são processados em memória, sem gravação, upload ou áudio. O motor e o modelo de OCR estão incluídos no ZIP. O navegador pede autorização para escolher a janela; **Parar captura** encerra o compartilhamento. O teste de leitura no navegador passou com um recorte privado do HUD; a captura contínua no Firefox precisa ser conferida no client pelo usuário.

Frames stay in memory: no recording, uploads or audio. The OCR engine and model are bundled. The browser asks you to choose a window; **Stop capture** releases it. Browser OCR was checked against a private HUD crop; continuous Firefox capture still needs live client validation.
