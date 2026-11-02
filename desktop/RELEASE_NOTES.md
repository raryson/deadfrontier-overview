## Windows 0.8.3

- Reduz o stream de captura de 60 para 15 fps e reutiliza o canvas do detector. Quadros sem diálogo não são clonados para o histórico em memória.
- Buffer recente reduzido de 60 para 6 recortes. Mantém captura automática e Shift+F para diálogos rápidos.
- Um leitor de loot carregado sob demanda, em vez de dois iniciados com a captura; encerra após 20 segundos sem trabalho. Até três amostras por diálogo e duas tentativas de OCR por amostra; quantidades podem usar uma terceira verificação. Leituras numéricas conflitantes ficam pendentes.
- Um item reconhecido com quantidade válida encerra as tentativas automáticas daquele diálogo. Nomes/quantidades duvidosos preservam as amostras para revisão.
- XP a cada dois segundos, com no máximo três tentativas por ciclo. Ausência repetida de HUD aumenta o intervalo para cinco segundos. A última região/filtro bem-sucedidos são priorizados; pixels idênticos reutilizam a leitura por até dez segundos.
- Painel e overlay escondidos não recebem reconstruções periódicas de estado. A lista de itens a cotar também só é recalculada quando loot, catálogo ou associações mudam. Atualizações visíveis são agrupadas e avaliações de loot são reutilizadas enquanto preços e registros não mudam.

A taxa menor reduz o custo de captura; diálogos mais breves que um intervalo de amostragem ainda podem ser perdidos. Não altera os FPS do próprio jogo nem grava vídeo.
