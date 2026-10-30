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
