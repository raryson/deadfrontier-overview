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

Abra o jogo, configure o multiplicador efetivo se quiser estimar XP sem bônus e clique **Iniciar sessão**. Os números no overlay usam os dados salvos pelo jogo no servidor, com consulta a cada ~30 segundos enquanto a página permanece aberta. A XP base é uma estimativa e depende do multiplicador informado. Mudanças de bônus devem ser acompanhadas de ajuste do fator. O client pode demorar a salvar a XP.

Open the game, set your effective multiplier if you want estimated XP without bonuses, and click **Start session**. Overlay numbers use server-saved game data, refreshed about every 30 seconds while the game page stays open. Base XP is an estimate based on your multiplier; update it when bonuses change. Client saves may be delayed.

Documentação / Documentation: https://github.com/raryson/deadfrontier-overview
