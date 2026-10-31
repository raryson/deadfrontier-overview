# Windows desktop preview 0.1.0

Extraia todo o ZIP e abra `DeadFrontier Overview.exe`. Deixe o acompanhamento automático ligado e abra o client do jogo. A janela é associada ao processo do Dead Frontier, sem repetir um seletor de compartilhamento. A sessão começa na primeira leitura estável.

- Overlay próprio, acima da janela do jogo e com cliques passando para o client.
- XP recebida, XP/h, perdas e estimativas sem bônus por multiplicador informado.
- Sessões em SQLite local, com exportação CSV.
- Parar congela; Salvar e zerar preserva a anterior e abre outra sessão.
- Fechar o jogo salva e encerra a medição. O app pode ficar na bandeja aguardando outra partida.
- Alt+Shift+D: painel. Alt+Shift+O: overlay.
- Interface em português e inglês.

Não precisa instalar Node.js ou SDK para usar o pacote. Fechar o painel deixa o app na bandeja; use Sair para encerrar. O app não se cadastra na inicialização do Windows.

Os recursos de XP do addon ainda estão disponíveis durante a migração. Loot, preços e comunicação com o addon não fazem parte deste primeiro app. O histórico anterior da extensão continua nela. O app utiliza um perfil local; não faz login nem detecta automaticamente troca de personagem na mesma janela.

Captura e OCR são locais, sem áudio, gravação ou upload. A precisão continua limitada pelo HUD: valores em K têm passos de aproximadamente 1.000 XP. Leia `desktop/README.md` no repositório para calibração, armazenamento e limitações.

Validação: 67 testes da extensão e 3 do desktop, teste completo de captura com uma janela fictícia e confirmação de detecção, leitura inicial e overlay no client real.

## English

Extract the entire ZIP and run `DeadFrontier Overview.exe`. Leave automatic tracking enabled and open the game client. The app associates capture with the game's process and starts the XP session on the first stable readout, without a recurring browser sharing picker. Includes a click-through overlay, local SQLite session history, CSV export and estimated XP without bonuses. Alt+Shift+D toggles the dashboard; Alt+Shift+O toggles the overlay.

This is an initial Windows preview. The existing extension remains available during migration. Loot, pricing, browser integration and automatic character identification are not included yet. Capture/OCR are local, without audio, recording or uploads.
