# Windows preview 0.3.2 — leitura de loot e quantidades

- Separa nome e quantidade: Gasoline (812) vira Gasoline e 812 ml; munição usa a quantidade da pilha.
- Normaliza os registros antigos com sufixo numérico sem alterar a sessão nem transformar resultados incertos em coletas.
- Lê nome e botões do mesmo quadro, com recorte alternativo para textos longos.
- Detecta o título para observar Yes/No/Use mais cedo e preserva cliques durante a leitura do nome. O helper verifica os quatro comandos a cada 20 ms, somente no client em primeiro plano quando o leitor está armado.
- Um diálogo antigo não confirmado deixa de bloquear um item diferente.
- Falha de OCR não equivale a fechamento enquanto os pixels do título continuam presentes.
- Quantidades precisam de leituras concordantes; ficam pendentes quando ambíguas e podem ser corrigidas no painel.

Use a extensão 0.9.1 para cotações de Gasoline em ml. Equipamentos continuam no Yard/NPC. O OCR permanece experimental: uma imagem do inventário final não comprova quais itens entraram durante uma sessão sem uma referência anterior.

Validation: 79 shared/extension tests and 20 desktop tests. Real-client dialog inspected: 12.7mm Rifle Bullets (880). Final Yes observation remains to be confirmed by the user. No screenshots, runtime databases or account data are included in this release.

## English

Separates item names from stack quantities, including Gasoline in ml, and repairs legacy stack labels without changing pickup outcomes. Uses one frozen dialog frame, earlier choice observation, faster native input polling and consecutive quantity validation. Uncertain prior dialogs no longer block new item names. OCR failures alone do not prove dismissal. Unknown quantities remain editable and excluded from estimates. Use browser addon 0.9.1 for Gasoline ml quotes. Loot OCR remains experimental.
