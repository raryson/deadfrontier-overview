## Windows 0.6.2

Shift + F faz uma captura manual extra do loot quando o client está em primeiro plano. Usa os pequenos recortes dos 200 ms anteriores ao comando, para que o OCR continue mesmo se F fechar o diálogo imediatamente. Não bloqueia teclas do jogo e não atua em outros aplicativos. A captura automática permanece ativa e compartilha o registro para evitar duplicação.

O overlay confirma o envio do recorte para a fila. Pressione uma vez com o diálogo visível e siga jogando; não é preciso esperar pelo OCR.

Validação: teste completo em janela fictícia sem título detectável automaticamente. Shift + F fechou o diálogo e o item foi reconhecido depois, uma única vez, como captura por atalho. Testes nativos cobrem foco, repetição, cooldown, captura manual e deduplicação. Histórico preservado.
