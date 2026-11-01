## Windows 0.6.1

- Captura de recortes a até 30 fps e fila de OCR independente: diálogos podem fechar imediatamente, inclusive usando F. Não aguarda cliques ou confirmação de aceite.
- Histórico e valores passam a indicar itens identificados e seu valor potencial. Dados anteriores são preservados.
- Corrige nomes de munição usando calibre e correspondência única do catálogo; mantém o texto original para conferência.
- XP exata sem K no início do nível; telas pretas tratadas como carregamento, preservando a sessão.
- Fila limitada em memória e indicação de recortes pendentes/overflow. Imagens não são gravadas nem enviadas.

Validação: quatro diálogos fictícios de 180 ms, reconhecidos após fecharem, incluindo dois Whiskey, 880 unidades de munição 12.7mm e 812 ml de Gasoline. Testes de deduplicação, filas, nomes, XP, quantidades e associação da sessão pelo instante de captura. O client real ainda precisa validar a cobertura dos diálogos rápidos. Extraia o ZIP inteiro.

O filtro de captura também foi conferido em um recorte real do jogo: o título cinza escuro de Item Found é detectado sem exigir o branco mais claro da janela fictícia.
