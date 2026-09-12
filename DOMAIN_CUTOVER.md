# FinObra — Cutover de domínio

## Estado alvo

- Frontend/edge: `https://finobra.app.br` → Cloudflare Worker `finan`
- API serverless: `https://api.finobra.app.br` → projeto Vercel `finan-as`
- WhatsApp/Baileys: Render (sem alteração)
- Banco: Neon (sem alteração)

## Ordem segura

1. Adicionar `api.finobra.app.br` como domínio do projeto Vercel `finan-as`.
2. Criar/validar o DNS solicitado pela Vercel para `api.finobra.app.br`.
3. Confirmar que `https://api.finobra.app.br/api/auth?action=me` responde pela API (401 sem sessão é aceitável).
4. Alterar `FINOBRA_API_ORIGIN` do Worker para `https://api.finobra.app.br`.
5. Confirmar `https://finan.brennodarlamm.workers.dev/__finobra/health` com `ok: true`, `loopRisk: false` e `configuredApiOrigin` apontando para `api.finobra.app.br`.
6. Fazer smoke test no `workers.dev`: login, cadastro, recuperação, `/app` e uma chamada de API autenticada.
7. Somente então adicionar `finobra.app.br` como custom domain do Worker Cloudflare.
8. Validar `https://finobra.app.br/__finobra/health`, login e `/app`.

## Proteção contra loop

O Worker bloqueia requisições `/api/*` com HTTP 503 quando `FINOBRA_API_ORIGIN` for igual ao próprio origin recebido. Isso evita recursão infinita se o domínio principal for movido para Cloudflare antes da API ser separada.

## Rollback

Se o domínio principal apresentar falha após o corte, remova/desative temporariamente o custom domain do Worker e restaure o apontamento anterior do `finobra.app.br`. O hostname `api.finobra.app.br` pode permanecer na Vercel.
