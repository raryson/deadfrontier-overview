# Instalar / Install

## Firefox 140+

1. No Firefox, abra `about:debugging#/runtime/this-firefox`.
2. Clique **Carregar extensão temporária…** e selecione este arquivo ZIP diretamente. Se já o extraiu, selecione `manifest.json` da pasta.
3. Recarregue o jogo e clique em **DeadFrontier Overview** no canto inferior direito.

O Firefox remove instalações temporárias ao reiniciar. Para instalação permanente, este pacote precisa ser assinado pela Mozilla. Este ZIP não é um XPI assinado.

**Atualizar:** se usa ZIP, clique novamente em **Carregar extensão temporária…** e selecione o ZIP novo. Se usa uma pasta, substitua todos os arquivos, incluindo `manifest.json`, e clique **Recarregar** na extensão. Feche as abas antigas do addon e abra outra pelo ícone. Recarregar só o jogo não atualiza o manifesto.

## Chrome

Extraia o ZIP. Abra `chrome://extensions`, ative **Modo do desenvolvedor**, clique **Carregar sem compactação** e escolha a pasta extraída. Recarregue o jogo.

## English

On Firefox 140+, open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on…**, and choose this ZIP directly (or `manifest.json` if already extracted). Reload the game. This temporary installation ends when Firefox restarts; permanent installation requires Mozilla signing. This ZIP is not a signed XPI.

On Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder.

**Updating Firefox:** for a ZIP installation, use **Load Temporary Add-on…** and select the new ZIP. For a folder, replace all files including `manifest.json`, then click **Reload** on the extension. Close old add-on tabs and reopen through its toolbar icon. Reloading only the game page does not update the manifest.

## XP / Experience

Abra a cidade uma vez para identificar o personagem. Pelo ícone da extensão, abra o painel em uma aba independente. Clique **Conectar janela do client** e selecione a janela do jogo no navegador. Confira a prévia e, se necessário, arraste um retângulo em volta da linha LV/XP. A sessão começa automaticamente na primeira leitura estável. Mantenha a aba aberta e abra a janela flutuante. Parar congela os resultados; Zerar salva a anterior e começa outra na próxima leitura com captura ativa. As últimas 100 sessões ficam na tabela de histórico deste navegador.

**Autorize a janela certa:** mantenha o client aberto e, no seletor do navegador, escolha a janela do **Dead Frontier**, confirmando em **Compartilhar / Permitir**. Prefira só a janela do jogo, em vez da tela inteira ou da aba da cidade. Se uma nova aba do addon abrir, clique novamente em Conectar nessa aba. A prévia deve mostrar o jogo com a linha LV/XP. Escolheu outra janela? Pare a captura e conecte novamente. Sem autorização não há leitura; cada nova conexão solicita a escolha da janela outra vez.

O OCR funciona localmente, sem gravar ou enviar imagens, e sem áudio. **Parar captura** libera a janela compartilhada. O HUD em K limita a precisão a aproximadamente 1.000 XP. A XP base depende do multiplicador efetivo informado; ajuste o fator quando os bônus mudarem.

Open the city once to identify your character, then open the extension in its own tab. Click **Connect client window**, select the game window, verify the preview and crop the LV/XP line if needed. The session starts automatically on the first stable readout. Stop freezes results; Reset saves the previous session and starts another on the next readout with active capture. The latest 100 sessions are saved in this browser's history table. Keep the tab open and open the floating window. OCR is local, without recording, uploads or audio. Stop capture to release the window. K values have roughly 1,000 XP precision. Base XP depends on your effective multiplier; update it when bonuses change.

**Allow the correct window:** keep the client open. In the browser picker, select the **Dead Frontier game window** and confirm **Share / Allow**. Prefer only that window instead of your entire screen or the outpost browser tab. If a new add-on tab opens, click Connect again there. Verify the preview shows the game and its LV/XP line. For a wrong selection, stop capture and reconnect. No permission means no readouts; each new connection asks you to choose a window again.

Documentação / Documentation: https://github.com/raryson/deadfrontier-overview
