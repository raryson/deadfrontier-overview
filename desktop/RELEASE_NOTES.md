## Windows 0.8.2

Prioriza um recorte justo da linha LV/XP antes das áreas amplas, reduzindo interferência do cenário na leitura de XP sem K. Mantém regiões alternativas para linhas longas, barra de título e calibrações manuais.

O caso real informado — nível 105, 45.459 XP / 6.600K (1%) — foi reproduzido com OCR local na imagem enviada. A região ampla confundia nível e dígitos; o recorte ajustado identificou nível 105 e 45.459 XP. O reconhecimento continua exigindo leituras estáveis; proteções de nível, percentual e sufixos permanecem ativas. A imagem do usuário não está incluída no código nem nos pacotes.

Validação: testes da região de leitura, fallbacks, calibração preservada e sequência de XP exata crescente com confiança moderada, além das regressões existentes.
