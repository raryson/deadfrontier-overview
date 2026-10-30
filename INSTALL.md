# Instalar / Install

## Firefox 140+

1. No Firefox, abra `about:debugging#/runtime/this-firefox`.
2. Clique **Carregar extensão temporária…** e selecione este arquivo ZIP diretamente. Se já o extraiu, selecione `manifest.json` da pasta.
3. Recarregue o jogo e clique em **DeadFrontier Overview** no canto inferior direito.

O Firefox remove instalações temporárias ao reiniciar. Para instalação permanente, este pacote precisa ser assinado pela Mozilla. Este ZIP não é um XPI assinado.

## Chrome

Extraia o ZIP. Abra `chrome://extensions`, ative **Modo do desenvolvedor**, clique **Carregar sem compactação** e escolha a pasta extraída. Recarregue o jogo.

## English

On Firefox 140+, open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and choose this ZIP directly (or `manifest.json` if already extracted). Reload the game. This temporary installation ends when Firefox restarts; permanent installation requires Mozilla signing. This ZIP is not a signed XPI.

On Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.

## XP / Experience

Abra a cidade uma vez para identificar o personagem. Pelo ícone da extensão, abra o painel em uma aba independente. Clique **Conectar janela do client** e selecione a janela do jogo no navegador. Confira a prévia e, se necessário, arraste um retângulo em volta da linha LV/XP. Espere uma leitura estável e clique **Iniciar sessão**. Mantenha a aba aberta e abra a janela flutuante.

O OCR funciona localmente, sem gravar ou enviar imagens, e sem áudio. **Parar captura** libera a janela compartilhada. O HUD em K limita a precisão a aproximadamente 1.000 XP. A XP base depende do multiplicador efetivo informado; ajuste o fator quando os bônus mudarem.

Open the city once to identify your character, then open the extension in its own tab. Click **Connect client window**, select the game window, verify the preview and crop the LV/XP line if needed. Wait for a stable reading, then click **Start session**. Keep the tab open and open the floating window. OCR is local, without recording, uploads or audio. Stop capture to release the window. K values have roughly 1,000 XP precision. Base XP depends on your effective multiplier; update it when bonuses change.

Documentação / Documentation: https://github.com/raryson/deadfrontier-overview
