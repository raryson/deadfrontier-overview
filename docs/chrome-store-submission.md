# Chrome Web Store — textos para o formulário

## Único propósito

Auxiliar o jogador a acompanhar e gerenciar sua sessão de Dead Frontier, reunindo relógios de buffs, métricas de XP e atalhos para operações da cidade em um painel e janela flutuante.

## alarms

Agendar verificações de expiração dos buffs registrados e sincronizados com o jogo, permitindo alertar o jogador quando um efeito termina, mesmo sem o painel aberto.

## notifications

Exibir notificações locais quando um buff acompanhado termina. Os avisos não são usados para publicidade ou mensagens de terceiros.

## storage

Salvar localmente preferências de idioma, prazos de buffs, identificador numérico do personagem, métricas e configuração da sessão de XP, multiplicador informado, coordenadas do recorte de OCR e cotações inseridas pelo usuário. Esses dados permitem manter o acompanhamento entre páginas e sessões do navegador; não são enviados a um servidor do desenvolvedor.

## Acesso ao host

Acessar somente as páginas de fairview.deadfrontier.com para inserir o painel, ler os campos necessários de buffs e XP, consultar saldos de moeda virtual e executar depósitos ou saques solicitados explicitamente pelo jogador. As operações usam os endpoints HTTPS do próprio jogo e sua autenticação já existente na página. Não há acesso ao histórico geral de navegação.

## Código remoto

Selecione “Não, não uso código remoto”.

Se houver campo para explicação: todo o código executável, incluindo worker, WebAssembly e modelo de OCR, está incluído no pacote. Não há carregamento de código por CDN nem execução de código baixado. Respostas do servidor do jogo são tratadas como dados; o HTML obtido para inicializar operações bancárias não é executado.

## Política de privacidade

https://github.com/raryson/deadfrontier-overview/blob/codex/initial-release/PRIVACY.md

A extensão trata dados do jogo e a janela autorizada mesmo quando o processamento é apenas local. As declarações da loja devem refletir esse tratamento; não declare ausência de uso de dados apenas por não haver upload. A política descreve dados locais, autenticação restrita ao jogo, captura em memória, controle do usuário e Uso Limitado. O responsável deve ler as declarações e confirmar as certificações correspondentes no painel da loja.

## Capturas e contato

Use `dist/store-overview-pt.png` e/ou `dist/store-xp-pt.png`, em 1280 × 800 pixels, produzidas com dados fictícios. Os arquivos ficam fora do código distribuído e de capturas de contas reais.

Em Configurações da conta de desenvolvedor, informe um e-mail de contato que você acompanha e confirme o link recebido. Salve o rascunho depois de preencher os campos.
