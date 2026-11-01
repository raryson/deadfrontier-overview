# DeadFrontier Overview 0.9.2 — correção da conexão com o app

Corrige o erro Failed to execute 'fetch' on 'WorkerGlobalScope': Illegal invocation ao conectar a extensão ao app Windows. A função fetch mantém o contexto global correto no service worker, tanto no pareamento quanto nas consultas do mercado.

Chrome: extraia o novo ZIP para a pasta da extensão instalada, abra chrome://extensions e clique em Recarregar. Reabra o painel, gere um novo código no app e conecte novamente. Firefox: recarregue o novo pacote temporário ou atualize o pacote assinado.

O app Windows 0.4.0 continua compatível. Nenhuma permissão nova.

Validation: 81 extension/shared tests, authenticated local extension/app integration, and an isolated Chromium Worker reproducing the exact old error and passing with the bound fetch.

English: fixes Illegal invocation from WorkerGlobalScope.fetch during local-app pairing and market requests. Update/reload the browser addon, reopen its panel and use a new pairing code. Windows app 0.4.0 remains compatible. No new permissions.
