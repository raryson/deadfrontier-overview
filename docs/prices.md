# Preços no app / Prices in the app

Requer extensão **0.9.0** e app Windows **0.3.0** ou superior. Nomes de itens permanecem como no jogo; apenas a interface é traduzida.

## Conectar uma vez

1. Atualize a extensão. No Chrome, extraia o ZIP para Chrome na pasta usada em chrome://extensions e clique em Recarregar. No Firefox, recarregue a extensão temporária ou carregue o novo ZIP. Reabra o painel pelo ícone do navegador.
2. Abra o app Windows e, em **Preços do mercado**, clique em **Gerar código de conexão**.
3. Na extensão, em **Preços no app Windows**, digite os oito dígitos e clique em **Conectar ao app**. Autorize os acessos opcionais solicitados ao app local e ao site do jogo.
4. Abra ou recarregue o **inventário da cidade**. A extensão lê as definições públicas dos itens e a função de valor do Yard usada pelo jogo.
5. Use **Sincronizar agora** ou aguarde a consulta automática. Os valores aparecem no app, no histórico de sessões, no CSV e no overlay.

O pareamento é mantido após reiniciar os programas; não é necessário repetir o código em cada sessão. O código expira em cinco minutos e funciona uma vez. A extensão deve continuar instalada e o navegador precisa estar aberto para novas consultas. O app não consulta o mercado diretamente.

## Referências de valor

- **Equipamentos comuns** (armas, armaduras, mochilas, implantes e roupas): valor-base de venda no **Yard/NPC**, informado pela função do jogo. Não geram buscas automáticas no mercado.
- **Equipamento customizado / GC / NGC**: na busca manual da extensão, marque a opção de equipamento customizado e consulte o nome original. No loot do app, escolha a variante exata com os atributos correspondentes. O padrão continua sendo Yard; o OCR não identifica craft pelo nome.
- **Demais itens**: menor preço por unidade observado nos anúncios retornados, separado por zona de mercado. É uma referência, sem garantia de venda ou desconto de taxas.
- **Dinheiro**: valor nominal do loot aceito, sem depender de cotação.

Anúncios vencem em **15 minutos**. A consulta automática tem cache de dez minutos e limite de **seis buscas por minuto**. Somente nomes reconhecidos pelo catálogo são consultados. Uma busca de equipamento comum é bloqueada mesmo quando iniciada manualmente sem marcar a exceção customizada. A referência Yard é atualizada ao recarregar a cidade, sem depender de anúncios.

Munição é normalizada por unidade. Se a quantidade do loot não foi lida, informe-a na linha correspondente; ela fica fora do total até então. A durabilidade de armaduras não é tratada como quantidade de unidades.

Se o OCR errou o nome, use **Associar um nome lido pelo OCR** no app. A associação escolhe a definição original do jogo, sem tradução nem aproximação automática de nomes. Equipamentos associados continuam no Yard até a escolha explícita da variante customizada daquele loot.

O total soma dinheiro aceito, itens com referência disponível e quantidades conhecidas. A contagem de **sem preço ou quantidade** identifica o que ficou de fora. Os valores históricos são recalculados com as referências sincronizadas atuais; não representam o preço de uma venda passada. O CSV inclui cashLoot, estimatedItemLoot e unpricedLoot.

## Dados e conexão

A conexão usa apenas 127.0.0.1:17373. O app recebe definições públicas de itens, referência Yard e cotações filtradas. Cookies, senha, ID da conta, nomes de vendedores e imagens não fazem parte do protocolo. As buscas públicas usam credentials: omit. O servidor só aceita as rotas de catálogo/preço, protegidas por pareamento; não possui operações bancárias ou comandos do jogo. A credencial local fica na extensão, e o app guarda apenas seu hash. **Desconectar extensões** revoga o acesso e encerra o servidor local.

Se o app estiver fechado, as consultas manuais ficam pendentes e são reenviadas quando ele voltar. A sincronização automática não consulta o jogo quando o app está indisponível.

## English

Update the browser extension to **0.9.0** and the Windows app to **0.3.0**. Generate an eight-digit code under **Market prices** in the app. Open the extension from the browser toolbar, enter the code under **Prices in the Windows app**, and allow the optional local-app/game-site access. Reload the outpost inventory to load the public item catalog and Yard reference. Pairing persists across restarts.

Ordinary equipment uses **Yard/NPC values** and is excluded from automatic market searches. Custom/GC/NGC equipment requires an explicit manual search and exact variant selection for that loot. Other items use the lowest observed unit listing in the chosen trade zone. Quotes expire after 15 minutes; the query cache lasts ten minutes, with a six-query-per-minute limit. Unknown quantities, missing quotes and unconfirmed pickups are excluded from totals. Original item names are never translated.

The app receives filtered price/catalog data over authenticated loopback only. No account credentials, cookies, seller identities or screenshots are transferred. Prices remain estimates; crafting attributes are not inferred from OCR. CSV values use current synced references rather than historical realized sales.

## Referências técnicas

- [Requisições entre origens em extensões Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)
- [Permissões opcionais do Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/optional_host_permissions)
- [Protocolo de anúncios: implementação pública de referência](https://greasyfork.org/en/scripts/441829-dead-frontier-api/code). O endpoint e o formato também foram conferidos com consultas públicas reais. A extensão não incorpora esse script.
