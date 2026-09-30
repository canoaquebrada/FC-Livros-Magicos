# FC Livros Mágicos

O cliente preenche um briefing de 12 etapas (idade, foto, tema, sentimento, estilo, criança, objetivo, elenco, idioma, toques finais, prévia e revisão) e **envia o pedido para o WhatsApp da loja, onde o pagamento é combinado**. A loja recebe o resumo, a foto e um link privado com tudo, e produz o livro.

## Como funciona

1. **Wizard com URL por etapa** (`/criar/idade`, `/criar/foto`, `/criar/tema`, `/criar/sentimentos`, `/criar/estilo`, `/criar/estrela`, `/criar/objetivo`, `/criar/personagens`, `/criar/idioma`, `/criar/dedicatoria`, `/criar/revelacao`, `/criar/revisao`) com deep link, `history.pushState`, barra "Passo N de 12", recorte de foto em canvas, elenco de apoio, idioma do livro e prévia antes/depois gerada no navegador.
2. **Revisão** → "Enviar pedido pelo WhatsApp": o servidor grava o pedido, gera o código e devolve (a) o link privado `/pedido/<código>?t=...` e (b) o link `wa.me` com o resumo já escrito. O navegador abre o WhatsApp; o cliente toca em enviar.
3. **Página do pedido** (mostra a foto, todos os campos, o valor e a chave Pix) e **painel da loja** (`/painel?token=...`) para listar, abrir e apagar pedidos.
4. Opcional: `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` fazem o servidor enviar o pedido sozinho (foto + resumo) pelo WhatsApp Cloud API, sem depender do cliente tocar em enviar.

Nenhum pagamento é processado no site: não há checkout, Pix automático nem pedido pago fictício. O dinheiro é combinado no WhatsApp.

## Configuração

Copie `.env.example` para `.env` e preencha (o `npm run dev` lê esse arquivo):

| Variável | Para quê |
|---|---|
| `WHATSAPP_NUMBER` | número da loja (DDI + DDD + número, só dígitos) — habilita o link wa.me |
| `SHOP_NAME` | nome que aparece no resumo |
| `PRICE_LABEL`, `PIX_KEY` | valor e chave Pix exibidos no site e na página do pedido |
| `ORDER_SECRET` | segredo que assina o link privado do pedido (no Cloudflare, use secret) |
| `ADMIN_TOKEN` | abre `/painel?token=...` e permite apagar pedidos |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | opcional: envio automático pelo Cloud API |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | opcional: geração da história (`mock`, `openai`, `gemini`, `anthropic`) |

## Rodar

Requer Node 20+. Sem dependências externas.

```
npm run build
npm run validate
npm run smoke
npm run dev   (http://localhost:8787)
```

`npm run build` gera `dist/server/index.js` (Worker ESM único com HTML embutido). `npm run validate` cobre sintaxe do cliente, as 12 rotas de passo, o passo inicial injetado, limites de foto/elenco, salvamento e isolamento de sessão, origem, o fluxo do pedido (código, link privado, wa.me, página do pedido, painel, exclusão) e a geração opcional com o PDF. `npm run smoke` renderiza as 12 etapas em um DOM simulado e confere a revisão.

Para publicar fora de Sites, configure um bucket R2 com binding `BUCKET` e as variáveis acima como secrets no Cloudflare Workers e publique `dist/server/index.js`.

## Produção (somente administrador)

Nada de produção é exposto ao cliente. Quem preenche o formulário vê apenas as próprias respostas, a própria foto e o botão de envio; o botão "Baixar minhas respostas" entrega um JSON com o que ele respondeu (sem prompts, sem cenas, sem PDF). As rotas antigas de geração por sessão foram removidas (`/api/book` e `/api/book/pdf` respondem 404).

Todo o material de produção fica na página do pedido, que só renderiza a parte administrativa quando aberta com o `ADMIN_TOKEN`:

- **Resumo enviado** (o texto que vai no WhatsApp) e botão de copiar;
- **Cenas de produção**: as 10 cenas com a descrição e o prompt de ilustração, montados a partir do briefing;
- **História** de 30 páginas + 14 prompts, gerada por `POST /api/admin/book?code=<código>&token=<ADMIN_TOKEN>` (com `AI_PROVIDER`/`AI_API_KEY` usa OpenAI, Gemini ou Anthropic; sem chave, um provedor de demonstração);
- **PDF** A4 (texto + JPEG embutido, sem dependências) em `GET /api/admin/pdf?code=<código>&token=<ADMIN_TOKEN>`.

No `painelHtml`, cada pedido abre pelo token do próprio pedido; use `?t=<ADMIN_TOKEN>` para abrir a visão completa de produção.

## Privacidade

A foto é dado pessoal de criança (LGPD art. 14). O link do pedido é privado e temporário: trate como documento sigiloso, use apenas na produção e apague o pedido pelo painel depois de entregar. As páginas do pedido e do painel não são indexáveis (`noindex`, `no-store`).

## Estrutura

```
worker/page.html   interface, wizard, revisão e envio do pedido
worker/order.js    código do pedido, resumo, cenas de produção, página do pedido (cliente × admin), painel e Cloud API
worker/story.js    geração da história (30 páginas + 14 prompts) por provedor
worker/pdf.js      compositor de PDF A4 sem dependências
worker/server.js   rotas /criar/<passo>, /api/order, /api/shop, /api/admin/*, /pedido/*, /painel e persistência por sessão
scripts/build.mjs  empacota tudo em um único módulo Worker
scripts/dev.mjs    servidor local com .env e BUCKET simulado em .local-r2/
scripts/validate.mjs, scripts/smoke.mjs  verificação de rotas, API e renderização
```

A tabela de rotas do servidor e a lista de etapas do cliente são comparadas por `npm run validate`: adicionar ou renomear uma etapa exige atualizar as duas.
