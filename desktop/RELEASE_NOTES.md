## Windows 0.8.1

- Exige a moldura do quadro de loot e os botões antes de guardar ou analisar uma imagem. A mesma validação vale para Shift+F.
- Não inicia outro registro por uma oscilação breve do detector ou uma alteração rápida do fundo através do diálogo transparente.
- Revisa amostras posteriores do mesmo quadro para melhorar texto inicialmente encoberto; um nome conhecido pode substituir uma leitura desconhecida sem duplicar o item.
- Prioriza recorte de texto mais estreito e reconhece o prefixo Grey de armaduras presentes no catálogo.
- Itens comuns ficam com quantidade 1, inclusive no histórico e na revisão. Munição e Gasoline mantêm validação da quantidade.
- Capturas antigas sem quadro de loot, ainda pendentes ou ilegíveis, são ocultadas da lista. As imagens originais permanecem no banco local; capturas válidas ilegíveis continuam disponíveis para revisão.

Validação: regressões do detector, oscilações, refinamento de OCR, quantidades e migração; amostra privada de 19 capturas relatadas pelo usuário rejeitou 15 cenas sem diálogo e preservou as 4 imagens com o quadro realmente visível. Imagens do usuário não fazem parte do código nem dos pacotes publicados.
