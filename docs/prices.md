# Preços no app / Prices in the app

App Windows **0.5.0** ou superior. Nomes de itens permanecem no idioma original.

## Usar sem código ou extensão

1. Extraia o ZIP Windows completo e abra `DeadFrontier Overview.exe`.
2. Em **Preços do mercado**, mantenha **Secronom Bunker / Outposts** ou selecione outra região. A escolha fica salva no app, sem seguir a localização do navegador.
3. Jogue normalmente. Quando o OCR reconhecer um loot do catálogo, o app prepara uma consulta pública. Uma coleta aceita com quantidade conhecida entra no total assim que houver referência disponível.
4. Para testar sem coletar, informe **Gasoline** em **Nome original do item** e clique em **Consultar preço**. Abra **Referências Yard e cotações** para conferir preço unitário e horário.

O catálogo público acompanha o app: 1.308 definições e 857 valores-base Yard nesta versão. O snapshot está em `desktop/data/item-catalog.json`; contém apenas identificador, nome, categoria e valor-base público, com data e origem. Novas definições podem ser incorporadas em atualizações ou pela integração opcional abaixo.

## Referências de valor

- **Equipamentos comuns**: valor-base de venda no **Yard/NPC**. Não geram buscas automáticas no mercado.
- **Equipamento customizado / GC / NGC**: marque a exceção na consulta manual do app. No loot, selecione a variante exata com os atributos correspondentes. O padrão continua sendo Yard; o OCR não identifica craft pelo nome.
- **Consumíveis e munição**: menor preço por unidade dos anúncios retornados na região selecionada. **Gasoline usa ml**. É uma estimativa, sem garantia de venda ou desconto de taxas.
- **Dinheiro**: valor nominal aceito, sem cotação.

Secronom e os demais outposts compartilham a região atual **21**. A seleção também inclui Camp Valcrest, Wastelands e regiões da cidade. Não usamos os IDs antigos dos outposts como mercados separados.

Anúncios vencem em **15 minutos**. O cache automático dura dez minutos, com até **seis buscas por minuto**, inclusive nas consultas manuais. Erros de rede aguardam um minuto antes de nova tentativa automática. **Atualizar cotações pendentes** processa as necessidades respeitando cache e limite; não faz uma varredura de todo o catálogo.

Sem anúncio, nome reconhecido ou quantidade, o item fica indicado como sem referência; o app não inventa um preço. Se o OCR errou, use **Associar um nome lido pelo OCR**. Nomes de equipamentos com cor ou variante que não coincidam com o catálogo também podem precisar dessa associação. Quantidades continuam editáveis na linha do loot. A durabilidade de uma armadura não é quantidade de unidades.

O histórico e o CSV usam referências atuais, sem representar vendas realizadas no passado. Coletas incertas não são contabilizadas até confirmação explícita do usuário.

## Integração opcional com o navegador

Não é necessária para preços no app 0.5.0. Serve para atualizar as definições públicas do catálogo a partir da cidade.

1. No app, abra **Opcional: atualizar catálogo pela extensão** e gere um código.
2. Na extensão **0.9.3**, abra a seção opcional de catálogo e informe os oito dígitos. Autorize o acesso local quando solicitado.
3. Recarregue o inventário da cidade. A extensão envia apenas definições públicas filtradas. Não importa sessões de XP.

O código autoriza a extensão a escrever no app local; expira em cinco minutos e funciona uma vez. A credencial persiste no navegador. A extensão 0.9.3 reconhece o app novo e deixa as consultas automáticas de mercado para ele. A busca manual antiga permanece para compatibilidade com apps anteriores.

**Desconectar extensões** revoga esse acesso e encerra o servidor local. As consultas diretas continuam funcionando. Se a integração opcional disser para conectar novamente, isso não impede as consultas próprias do app.

## Dados e conexão

O processo principal do app consulta somente o endpoint público `https://fairview.deadfrontier.com/onlinezombiemmo/trade_search.php`, com `credentials: omit`, sem login nem cookies. Os campos aproveitados são item, nome, preço, quantidade e região; identificadores de vendedores não são armazenados. Os renderers continuam sem acesso arbitrário à rede. Não existem operações de compra, venda ou banco no app.

A integração opcional mantém `127.0.0.1:17373` autenticado por pareamento. Cookies, senha, ID da conta e imagens não fazem parte do protocolo. O app guarda apenas o hash da credencial local.

## English

Windows app **0.5.0** queries public listings directly; no extension or pairing code is needed. Keep **Secronom Bunker / Outposts** as the default or choose another region in **Market prices**. Enter **Gasoline** and click **Look up price** to test. Confirmed pickups with recognized names and known quantities are valued automatically as quotes become available.

Ordinary equipment uses bundled **Yard/NPC values** without market searches. Custom equipment requires an explicit manual query and exact variant selection. Other items use the lowest observed unit listing; Gasoline uses ml. Quotes expire after 15 minutes; cache lasts ten minutes, with up to six queries per minute. Missing or uncertain values stay excluded and can be corrected manually.

The optional extension connection updates public catalog definitions only. Its eight-digit code protects local write access. No account credentials, cookies, screenshots or seller identities are transferred. Your sessions stay local and are preserved during updates.

## Referências técnicas

- [Protocolo e regiões do mercado: implementação pública de referência](https://greasyfork.org/en/scripts/441829-dead-frontier-api/code). Conferidos também no código público do jogo e em consultas reais. Este script não é incorporado ao app.
- [Requisições em extensões Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Permissões opcionais Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/optional_host_permissions)
