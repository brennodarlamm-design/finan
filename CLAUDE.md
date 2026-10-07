# CLAUDE.md — FinGo

As regras inegociáveis do projeto estão no AGENTS.md e valem integralmente para o Claude:

@AGENTS.md

## Resumo do que mais importa

- **Nunca faça deploy** (Cloudflare, Render ou Vercel) e nunca rode `npm run build:cloudflare`, `npm run deploy:*` ou `wrangler`. O deploy é feito por uma pessoa, depois de testes → commit → push.
- **Nunca escreva segredos** (connection strings, tokens, chaves) em arquivos do repositório. Use apenas `process.env.*` e placeholders.
- **Antes de concluir qualquer mudança**, rode `npm test`. Se falhar, corrija ou explique no PR.
- **Commits semânticos**: `tipo(escopo): descrição no imperativo`. Tipos: feat, fix, perf, style, refactor, sec, test, docs.

## Mapa rápido do código

- `api/` é o código de backend que roda de verdade (Cloudflare Worker via `api/_edge-adapter.js` e Render via `backend/server.js`). `backend/domains/` são cópias espelhadas de `api/`: ao alterar `api/X.js`, copie para o espelho indicado em `scripts/organize-modular-files.cjs`.
- `js/` e `frontend/core` + `frontend/domains` são cópias idênticas (validado por `npm run test:monolito`). Edite os dois.
- Autenticação: `resolveAuthAndTenant(req)` retorna `auth.tenantId`, `auth.isSystem`, `auth.user.perfil` e `auth.user.tenantPlan`. Não existem `auth.role` nem `auth.plan`.
- Rate limit: `checkRateLimit(key, limit, windowMs)`; a chave é uma string.
- Toda query de dados de negócio filtra por `tenant_id`; o banco usa RLS (Neon Postgres).
- SINAPI no banco: tabela `itens_referenciais` (helper `api/_sinapi-reference.js`).
- Frontend com CSP estrita: nada de `onclick` inline; use `data-fb-click="Modulo.metodo"` (barramento em `patch26-events.js`) e escape interpolações com `Utils.esc`.
- Arquivos usam CRLF; preserve as quebras de linha ao editar.
- HTML: as páginas públicas ficam em `marketing/pages/` e os shells (login `index.html`, `app.html`, `master.html`, `bim.html`) em `frontend/`. Não crie `.html` na raiz.
- BIM/3D: leia `.agents/skills/fingo-bim-3d-pipeline/SKILL.md` antes de mexer.

## Documentação

- Arquitetura: `docs/architecture/ESTRUTURA_DO_SISTEMA.md`, `docs/architecture/MONOLITO_MODULAR.md`
- Segurança: `docs/security/README.md`, `docs/AUDITORIA_SEGURANCA_2026-10-02.md`
- Produto e workflow: `conductor/`
