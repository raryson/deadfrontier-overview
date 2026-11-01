## Windows 0.5.2

Corrige a confirmação de fechamento do loot durante sequências de cliques: quadros recentes ligados aos cliques agora também podem confirmar o desaparecimento, após uma escolha já reconhecida. Exige três quadros distintos e rejeita quadros antigos, futuros ou anteriores à escolha. Não transforma registros antigos incertos em coletas aceitas.

Inclui a correção de percentual do HUD da 0.5.1. Sessões e dados são preservados.

## Windows 0.5.1

Correção identificada em partida real: o OCR pode ler 16% como 167%, confundindo o parêntese do HUD. XP exata abaixo de um milhão agora aceita essa correção somente quando o percentual reparado concorda com XP/limiar. Leituras incompatíveis continuam rejeitadas.

A leitura evita testar a posição alternativa de barra de título quando já encontrou um HUD legível, reduzindo trabalho redundante. Sessões, loot e referências de preço são preservados.

Loot continua experimental: escolhas sem confirmação visual permanecem incertas.
