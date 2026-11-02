## Windows 0.8.0

- Captura de loot a até 60 fps, dois workers de OCR e fila de 64 diálogos. Detecta mudanças de item sem exigir que o diálogo desapareça entre elas.
- Salva o recorte local antes do OCR. Capturas sem leitura ou com fila cheia continuam disponíveis para revisão, sem entrar automaticamente nos totais.
- Histórico → Detalhes da sessão reúne XP recebida, XP/h, perdas, XP líquida, base estimada, duração e todos os loots registrados em páginas de 100.
- Revisão com imagem, texto original, correção de item/quantidade e associação reutilizável. Correções manuais não são sobrescritas por resultados atrasados do OCR.
- Pequenos JPEGs de loot ficam no SQLite local por padrão; opção para desligar imagens futuras em Preferências. Sem upload. Capturas anteriores à atualização não possuem imagens.
- Melhora o início de sessão com XP exata sem K e confiança moderada, exigindo três leituras coerentes. Mantém verificações de saltos e sufixos perdidos.

Validação: 86 testes compartilhados e 63 testes desktop; teste integrado com cinco diálogos diferentes a cada 250 ms, sem intervalo vazio, confirmou cinco registros e imagens, Gasoline 812 ml, munição 880 e ganho contínuo de XP sem K. A captura real em Onslaught ainda depende da duração/visibilidade de cada diálogo.
