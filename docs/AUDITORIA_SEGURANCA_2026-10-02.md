# Auditoria de segurança e backend — 02/10/2026

Escopo: `api/`, `cloudflare-worker.js`, `backend/server.js`, migrações e testes relacionados. Frontend fora do escopo.
Método: leitura do código, provas locais com dados sintéticos e R2/SQL simulados, comparação da suíte antes e depois. **Nada foi executado contra produção, nenhum commit foi feito e nenhum deploy foi disparado.**

## Resumo

| # | Severidade | Problema | Status |
|---|---|---|---|
| F1 | 🔴 Crítica | `GET /api/v2/edge/media/optimize` lia qualquer objeto do R2 sem login, inclusive o backup diário do banco | Corrigido |
| F2 | 🔴 Crítica | Webhook de e-mail aceitava qualquer requisição que tivesse o header `svix-signature` | Corrigido |
| F3 | 🟠 Alta | Cliente escolhia o próprio IP com `x-vercel-id` + `x-vercel-forwarded-for` e escapava de rate limit/Fail2Ban | Corrigido |
| F4 | 🟠 Alta | Rate limit das rotas v2 (IA, OCR, ledger, anomalias) chamado com assinatura errada: um único bucket global | Corrigido |
| F5 | 🟠 Alta | Rotas v2 liam `auth.plan`/`auth.role` (inexistentes): OCR e SINAPI liberados para qualquer plano; ledger negado até para admin | Corrigido |
| F6 | 🟠 Alta | `sync_all` gravava `medicoes`, `orcamentos`, `produtos` e `documentos` sem checar permissão do módulo | Corrigido |
| F7 | 🟡 Média | Endpoints SINAPI consultavam a tabela inexistente `sinapi_itens`; devolviam lista fixa como "oficial", ignoravam UF/competência/termo e o plano | Corrigido |
| F8 | 🟡 Média | Página `/qr` do backend ficava aberta se `INTERNAL_API_SECRET` faltasse; sem limite de tentativas | Corrigido |
| F9 | 🟡 Média | `/api/v2/system/metrics` público (a mesma telemetria de `/__edge/metrics` é restrita a superadmin) | Corrigido |
| F10 | 🔵 Baixa | Validação pública de assinatura expunha o IP completo do signatário (LGPD) | Corrigido |
| F11 | 🔵 Baixa | Superadmin não conseguia editar a própria conta ("Perfil inválido") | Corrigido |

## Detalhes

### F1 — Backup completo do banco acessível sem login
`handleV2EdgeMediaOptimize` não chamava `resolveAuthAndTenant` e lia a chave recebida em `?key=` direto do bucket `fingo-attachments`. O cron do Worker (`api/_edge-backup.js`) grava nesse mesmo bucket `backups/neon-critical/AAAA-MM-DD/snapshot.json`, com tabelas inteiras de todos os tenants, incluindo `usuarios`. A resposta saía com `Cache-Control: public, max-age=31536000, immutable`.
Prova local (R2 simulado): antes → `200` com o JSON do snapshot; depois → `401`.
**Correção:** exige sessão, permissão de leitura em `documentos`, chave dentro de `tenants/<tenant>/`, conteúdo `image/*` (sem SVG), `Cache-Control: private, no-store`.

### F2 — Assinatura Svix não verificada
`isEmailWebhookAuthorized` retornava autorizado só pela presença do header `svix-signature` (com `EMAIL_WEBHOOK_SECRET` configurado). Qualquer pessoa conseguia injetar e-mails falsos na Central de E-mails.
**Correção:** `verifySvixSignature()` com HMAC-SHA256 sobre `id.timestamp.corpo`, tolerância de 5 min e comparação em tempo constante. O adapter Edge e o Express passam a guardar o corpo bruto (`req.rawBody`) para essa verificação.

### F3 — Falsificação de IP
`getTrustedClientIp` confiava nos headers da Vercel quando o próprio cliente enviava `x-vercel-id`. Agora isso só acontece se `process.env.VERCEL` estiver definido.

### F4 — Rate limit global nas rotas v2
`checkRateLimit(key, limit, windowMs)` era chamado como `checkRateLimit(req, rateKey, 30, 60000)`. Resultado: chave `"[object Object]"` para todos, limite 10 e janela de 1 s. As cotas por tenant/IP não funcionavam.

### F5 — Gates de plano/perfil quebrados
`auth.plan` não existe: o plano caía em `trial`, que libera todas as features. Com isso, OCR e busca semântica SINAPI ficavam liberados para qualquer plano. `auth.role` também não existe, então o append no ledger era negado inclusive para admin. Agora o código usa `auth.user.tenantPlan` e `auth.user.perfil`.

### F6 — Bypass de RBAC no `sync_all`
`SYNC_COLLECTION_TABLE` (`api/db.js`) não continha `medicoes`, `orcamentos`, `produtos` e `documentos`, mas `handleSyncAll` grava essas coleções. Isso permitia escrita apesar de restrição por perfil, plano ou permissão customizada. O teste novo cruza automaticamente as coleções gravadas com as checadas.

### F7 — SINAPI
Nenhuma migration nem o `schema.sql` cria `sinapi_itens`. A base real é `itens_referenciais`, gravada pelo robô. Situação anterior:
- `/api/db?table=sinapi`: falhava, ignorava filtros e checava o plano com `auth = null`, que cai em `trial`.
- `/api/v2/engineering/sinapi/export`, `/api/v2/edge/sinapi/cached` e a busca semântica: caíam numa lista fixa de 3–6 itens (preços de SP/2026-08) para qualquer UF.

Novo módulo `api/_sinapi-reference.js`: consulta filtrada por UF, competência (usa a mais recente se não for informada), regime e termo. Sem base disponível, a resposta é `503`/lista vazia. O CSV exportado neutraliza fórmulas.

### F8–F11
- **F8:** `/qr` responde `503` sem segredo configurado, compara a chave em tempo constante e bloqueia por 15 min após 10 tentativas erradas por IP.
- **F9:** as métricas v2 exigem superadmin.
- **F10:** o IP do signatário aparece mascarado (`200.10.*.*`).
- **F11:** um superadmin pode manter o próprio perfil ao editar a conta.

## Já corrigido antes desta auditoria (confirmado)
Do review anterior (`docs/reports/review-finan-report.md`), estes itens já estavam resolvidos:
- Ledger exige autenticação.
- Rotas de IA exigem sessão. A cota, porém, estava quebrada (ver F4).
- Upserts `ON CONFLICT (id)` têm `WHERE tenant_id`.
- `tenant_preferences` respeita RBAC.
- O robô SINAPI está protegido.

## Ações necessárias após o deploy
1. **Investigar o F1 nos logs.** Procurar no Cloudflare (Workers Logs/Logpush) e nas métricas do R2 por acessos a `/api/v2/edge/media/optimize` com `key=backups/` desde que a rota existe. Se houver acesso de terceiros:
   - forçar troca de senha de todos os usuários;
   - rotacionar segredos MFA, chaves de tenant e `SESSION_SIGNING_SECRET`;
   - avaliar a obrigação de comunicar à ANPD (LGPD art. 48).
2. **Purgar o cache** do Cloudflare para `/api/v2/edge/media/optimize*`.
3. **Configurar `RESEND_WEBHOOK_SECRET`** com o `whsec_…` do painel do Resend. Sem isso, webhooks assinados passam a ser recusados (comportamento correto).
4. **Seguir o AGENTS.md:** `npm test` → commit → push → `npm run build:cloudflare && npm run deploy:cloudflare` e `npm run render:deploy`.

## Segunda rodada — riscos remanescentes corrigidos

| # | Problema | Correção |
|---|---|---|
| R1 | Worker reenviava POST/PUT/PATCH/DELETE ao Render após 5xx do Edge (risco de gravação em dobro) | Fallback só para métodos seguros ou quando o Edge responde `X-FinGo-Edge-Unprocessed: 1` |
| R2 | Origem `*.onrender.com` acessível direto, com `cf-connecting-ip`/`cf-ray` forjáveis | `backend/origin_trust.js`: com `ORIGIN_SHARED_SECRET`, só o Worker autenticado informa o IP do cliente; demais requisições perdem os cabeçalhos de CDN e usam o último salto do `X-Forwarded-For`. `ORIGIN_ENFORCE_EDGE=true` bloqueia `/api/*` direto (webhooks e health liberados) |
| R3 | Snapshot diário em JSON puro no bucket de anexos | AES-256-GCM com `BACKUP_ENCRYPTION_KEY`, bucket dedicado `fingo-backups` (`BACKUPS_R2`), falha fechada sem chave; restauração com `scripts/decrypt-r2-backup.mjs` |
| R4 | `curva-abc`, `boletins`, `sinapi/cached` e `sinapi/export` sem limite | Limite por IP (Upstash Redis, fallback em memória): 30, 60, 120 e 10 req/min |
| R5 | OIDC/JWKS/auth.md anunciavam endpoints e chaves inexistentes | Metadados descrevem só o login por sessão real; JWKS vazio (HS256 não tem chave pública); OpenAPI e `auth.md` reescritos |

Também corrigido: `checkRateLimitRedis` renovava a janela a cada chamada (cliente acima do limite nunca era liberado sob tráfego contínuo). Agora usa janela fixa.

Mantido como está, por decisão do responsável: rota `/api/x402` com carteira de pagamento.

### Configuração necessária (antes/depois do deploy desta rodada)
1. **Criar o bucket de backups** (sem isso o `wrangler deploy` falha):
   `npx wrangler r2 bucket create fingo-backups`
2. **Chave do backup** (mín. 32 caracteres aleatórios; guarde em cofre de senhas, sem ela o backup não pode ser restaurado):
   `npx wrangler secret put BACKUP_ENCRYPTION_KEY`
3. **Segredo Worker → Render** (mesmo valor nos dois):
   `npx wrangler secret put ORIGIN_SHARED_SECRET` e, no painel do Render (`finan-backend`), a variável `ORIGIN_SHARED_SECRET`.
   Depois de confirmar que o app funciona pelo domínio oficial, mude `ORIGIN_ENFORCE_EDGE` para `true` no Render.
4. **Apagar os snapshots antigos em texto puro** do bucket `fingo-attachments` (painel R2 → `backups/neon-critical/*/snapshot.json`) depois que o primeiro `.enc` for gerado no bucket novo.
5. Gerar um segredo aleatório (PowerShell): `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))` (PowerShell 7) ou `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

Pressuposto a confirmar no R2: no Render, o último item do `X-Forwarded-For` é o IP visto pelo balanceador. Se os logs mostrarem o IP de um proxy em vez do cliente para acessos diretos, ajuste `backend/origin_trust.js`.

## Testes
- Novo: `scripts/test-audit-2026-10-02.js` (incluído em `npm test`). Cobre F1–F11 e R1–R5. Falha na versão anterior e passa na corrigida.
- Atualizados para o novo contrato:
  - `test-edge-v2-routes.js` e `test-review-remediation.js`: antes exigiam a lista fixa do SINAPI e o otimizador sem login.
- Comparação da suíte, antes e depois, em ambiente isolado: 126 testes, nenhuma regressão.
  - Parte dos testes não roda nesse ambiente porque depende de arquivos do frontend ou de pacotes (`pglite`) indisponíveis. Esses falham igualmente nas duas versões.
  - **Rode `npm test` localmente antes do commit.**
