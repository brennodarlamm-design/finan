# Auditoria de segurança e backend — 02/10/2026

Escopo: `api/`, `cloudflare-worker.js`, `backend/server.js`, migrações e testes relacionados. Frontend incluído a partir da sétima rodada.
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

## Terceira rodada — módulos ainda não auditados

Escopo: `auth.js` (reset de senha, MFA, Google), `whatsapp.js`, `nfe.js`/`_certificado.js`/`_sefaz-dfe.js`, `upload.js`, webhook PIX, `admin.js`/`_admin-route.js`, cofre de chaves, workflow, telemetria, Durable Object de tempo real e rotas internas do `backend/server.js`.

| # | Severidade | Problema | Correção |
|---|---|---|---|
| T1 | 🟠 Média | `verify_reset` lia `tentativas`, verificava o OTP e só depois incrementava. Requisições paralelas liam o mesmo contador e passavam do limite de 5 tentativas | A tentativa é reservada com `UPDATE … SET tentativas = tentativas + 1 … RETURNING` antes da verificação |
| T2 | 🟠 Média | MFA do superadmin limitado só por IP (8/5 min). Com a senha, era possível distribuir tentativas de TOTP/backup por vários IPs | Limite adicional por conta (`mfa-user:<id>`, 10 a cada 15 min) no login direto e no `mfa_verify` |
| T3 | 🟠 Média | `action=test` do WhatsApp aceitava destino e texto livres sem limite: disparo em massa pelo número da empresa (risco de banimento) | Usa o mesmo limite de `send` (20/min por empresa) |
| T4 | 🟠 Média | `POST /api/v2/edge/storage/upload` aceitava qualquer extensão e `Content-Type` (HTML, SVG, executáveis), contornando a validação de `/api/upload` | Lista fechada (pdf, png, jpg, webp, xlsx, docx, zip, txt, csv), assinatura binária conferida, `Content-Type` definido pelo servidor |
| T5 | 🟡 Média | `force: true` no `dfe_sync` ignorava a trava de 1 h da SEFAZ. Consultas repetidas podem bloquear o CNPJ por consumo indevido (cStat 656). `codUf` ia sem validação para o XML SOAP | `force` só para superadmin/sistema; `codUf` precisa ter 2 dígitos |
| T6 | 🔵 Baixa | Proxy MeuDanfe (`buscar`, `danfe`, `xml`, `sefaz_xml`) sem limite: uma empresa podia esgotar os créditos da conta compartilhada | 60 consultas a cada 10 min por empresa |
| T7 | 🔵 Baixa | `INTERNAL_API_SECRET` e chave do Evolution comparados com `===` (`_auth.js`, `whatsapp.js`, `backend/server.js`) | `secretsEqual()`/`safeEqualSecret()` em tempo constante |
| T8 | 🔵 Baixa | Telemetria anônima de erros disparava alerta `CRITICAL` (que vai por WhatsApp ao administrador) com 5 requisições forjadas | Pico sem sessão gera apenas `WARNING` |
| T9 | 🔵 Baixa | Recibo PIX por e-mail interpolava nome da empresa, responsável e TXID sem escape (injeção de HTML/links em e-mail do domínio oficial) | Escape HTML |
| T10 | 🟡 Média | Tokens antigos sem `sessionId` continuavam válidos por até 30 dias e não eram encerrados na troca ou no reset de senha | Recusados (401) antes de consultar o banco; o usuário entra de novo. Troca/reset de senha já revogava as demais sessões |

Revisado e sem problema encontrado: webhook PIX (segredo dedicado, valor e tenant conferidos, idempotência), `upload.js`, portal Master (MFA obrigatório em todas as ações), cofre de chaves DEV, workflow (filtro por `tenant_id` em todas as consultas), Google login (`email_verified`, superadmin excluído), cobrança (`create_invoice` usa preço do catálogo).

### Pontos para decisão do responsável (não alterados)
1. **Token na URL dos webhooks do WhatsApp** (`?token=` em `api/whatsapp.js` e `backend/server.js`). O segredo pode aparecer em logs. Se o Evolution Go permitir enviar a chave em header, remova o suporte a `?token=`.
2. **Certificado A1**: qualquer usuário com escrita em `notas` pode substituir o certificado da empresa. Avalie restringir a `admin`.
3. **Sala de colaboração em tempo real**: qualquer usuário da empresa entra, sem checar permissão do módulo de orçamentos.
4. **MFA de usuários de empresa** não é exigido no login (só o superadmin passa pelo TOTP).

## Quarta rodada — documentos, assinaturas e login

| # | Severidade | Problema | Correção |
|---|---|---|---|
| U1 | 🟠 Alta | `documentos.url` é gravável pelo cliente (`/api/db` e `sync_all`). Bastava gravar uma linha apontando para o arquivo de outra empresa no Vercel Blob para que `GET /api/upload` gerasse um link assinado de leitura e `DELETE /api/upload` ou `/api/db` apagasse o arquivo. A checagem de dono só existia quando a linha não existia | `isTenantStorageUrl()` (`api/_edge-r2.js`) exige o prefixo da empresa ao salvar, ao gerar o link e ao apagar. Links externos comuns continuam aceitos |
| U2 | 🟡 Média (regressão do F10) | A validação pública mascarava `ip_dispositivo`, mas o assinador grava ali o tipo de aparelho ("Computador / Desktop"), que passou a aparecer como `***` | Só mascara valores que parecem IP |
| U3 | 🟡 Média | A data/hora da assinatura vinha do navegador sem limite: dava para registrar assinatura retroativa ou futura, exibida como oficial | Diferença máxima de 24 h para o relógio do servidor. A validação pública mostra também "Registrado na base FinGo em" (horário do servidor) |
| U4 | 🟡 Média | Login checava conta inativa, empresa bloqueada/cancelada e trial vencido **antes** da senha: sem senha, dava para confirmar usuário e situação da empresa. O tempo de resposta também diferenciava usuário existente (scrypt) de inexistente | Senha conferida primeiro. Usuário ou empresa inexistente passam por um scrypt equivalente |
| U5 | 🟡 Média | Login com Google respondia "Chave da Empresa não encontrada" ou "conta não vinculada": com qualquer conta Google era possível testar quais chaves de 6 dígitos existem | Mesma resposta nos dois casos |

Revisado e sem problema novo: `_totp.js` (anti-replay por step, códigos de backup com hash), cofre de chaves DEV, alertas de borda (com intervalo mínimo por tipo), mutações e exclusões do `/api/db` (filtro por `tenant_id` em todas).

### Pontos para decisão do responsável (quarta rodada)
5. **`request_reset`** demora mais quando a conta existe (gera e grava o OTP). Para usuários de empresa isso exige a chave da empresa; risco baixo.
6. **TOTP e código de backup** são marcados como usados depois da verificação, sem trava. Duas requisições simultâneas com o mesmo código podem passar. Risco baixo (exige senha e código válido).
7. **Worker Cloudflare sem `NODE_ENV=production`**: nesse caso `MFA_ENCRYPTION_KEY` ausente cai para `SESSION_SIGNING_SECRET`. Confirme que `MFA_ENCRYPTION_KEY` está configurada nos Secrets do Worker.

## Quinta rodada — pendências resolvidas

`MFA_ENCRYPTION_KEY` confirmada nos Secrets do Worker pelo responsável.

| # | Problema | Correção |
|---|---|---|
| V1 | `request_reset` respondia mais rápido quando a conta não existia | Caminhos sem conta também calculam o hash do OTP. O tempo de envio por WhatsApp/e-mail ainda difere quando a conta existe (o envio é aguardado) |
| V2 | TOTP/código de backup gravados sem condição: duas requisições simultâneas com o mesmo código passavam | `consumeMfaFactor()` grava o step só se for maior que o último e consome o código de backup comparando a lista anterior |
| V3 | Qualquer usuário com escrita em `notas` trocava ou removia o certificado A1 | Upload e remoção exigem administrador (`canManageTenant`). Consulta de status continua liberada |
| V4 | Sala de colaboração em tempo real aceitava qualquer usuário da empresa | O Worker exige leitura no módulo `orcamentos` (perfil, plano e permissão customizada); edição exige escrita no módulo |

Itens 2 a 7 das listas de decisão acima: resolvidos (V1–V4, T10, MFA confirmada), exceto:
- **Token na URL dos webhooks do WhatsApp** (`?token=`): depende da configuração do Evolution Go.
- **MFA para usuários de empresa**: hoje só o superadmin é obrigado. Exigir de todos é decisão de produto.

## Sexta rodada — frontend de documentos, delta, SINAPI no Render e IA

| # | Severidade | Problema | Correção |
|---|---|---|---|
| W1 | 🔵 Baixa (contida pela CSP) | O visualizador de documentos colocava `doc.url`/conteúdo cru no `src` de `<iframe>`/`<img>`. O valor é gravável por qualquer usuário com escrita em documentos. A CSP (`script-src-attr 'none'`, sem `unsafe-inline`, `frame-src` restrito) impede execução, mas não havia defesa no código | `_safePreviewSrc()` aceita só `data:` de PDF/HTML/imagem, `http(s)` e `blob:`, sempre escapado. Fora disso, mostra "use o botão Baixar" |
| W2 | 🔵 Baixa | `GET /api/db?table=delta` devolvia IDs excluídos de todos os módulos, inclusive os que o usuário não pode ler | Filtro por permissão de leitura do módulo |
| W3 | 🟡 Média | `/api/sinapi/search` e `/api/sinapi/recalc` no Render eram públicos, sem limite. A busca faz `ILIKE '%termo%'` na base inteira (carga no Neon) e ignorava a regra de plano do SINAPI. O app não usa essas rotas | Exigem a chave interna, como `/robot/run` |
| W4 | 🔵 Baixa | Chave Gemini enviada na URL (`?key=`), que aparece em logs e mensagens de erro | Enviada no header `x-goog-api-key` |

Revisado e sem problema: tela de empresa e suporte em `users.js` (admin para alterar empresa, conversa filtrada pela empresa), leituras do `/api/db` (permissão por tabela em consulta, snapshot e delta), ledger (perfil de auditoria), e-mails de saída (tudo escapado), Central de E-mails no portal Master (HTML recebido exibido como texto), `/test-neon` e crons do Render (chave interna).

### Verificação recomendada (fora do código)
- **Chave Google do Drive Picker** em `js/gdrive.js` (`API_KEY`). Chave de navegador é pública por natureza, mas no Google Cloud ela precisa estar restrita por referenciador HTTP (`https://fingo.api.br/*`) e às APIs Picker/Drive. Sem essa restrição, qualquer pessoa pode usar a cota do projeto.

## Sétima rodada — frontend (injeção de HTML)

**Contexto que muda a gravidade:** a CSP bloqueia `<script>` e handlers inline, mas o barramento `data-fb-*` (`js/patch26-events.js`) aceita `click`, `focus`, `mouseover`, `input` etc. HTML injetado como `<input autofocus data-fb-focus="Modulo.acao">` executa uma ação da allowlist **sem clique**. Na prática, injeção de HTML equivale a disparar ações do app na sessão da vítima.

| # | Severidade | Problema | Correção |
|---|---|---|---|
| X1 | 🟠 Alta | Dados sem escape em `innerHTML`: **emitente e itens de NF-e** (`nfe.js`, `lancamentos.js`), que vêm de XML de terceiros, inclusive pelo sync automático do DF-e; nomes de obras e contas (`nfe.js`, `notas.js`, `ocr.js`, `parcelamento.js`); atributos de fornecedor (`fornecedores.js`); responsável (`fases_doc.js`, `exportar_templates.js`); mensagens de erro de provedores no portal Master (`master.js`) | `Utils.escapeHtml` / `this._esc` em todos os pontos |
| X2 | 🟠 Alta | O portal público do cliente monta a página a partir de `pdata` (JSON na URL). Qualquer pessoa pode criar o link. `dias_atraso` entrava cru: link forjado = HTML injetado em `fingo.api.br`, executado com a sessão de quem abrir logado | Valor forçado a número |
| X3 | 🟡 Média | No modo portal público, o barramento aceitava qualquer ação da allowlist (o app completo está carregado) | Em `portal-public-mode`, só ações `PortalCliente.*` e `Utils.closeModal` |

Revisado e sem problema: `validar_page.js` (tudo escapado), `master.js` (nomes de empresa, e-mails recebidos e leads escapados), `login_page.js` e `assinador.js` (parâmetros da URL não vão para o HTML), visualizador de documentos (W1).

### Recomendação (decisão do responsável) — implementada na oitava rodada (X4)
- **Assinar o link do portal do cliente.** Hoje o `token` do link é `btoa("finobra_portal_<tenant>_<obra>")`, sem segredo, e o conteúdo vem inteiro da URL. Qualquer pessoa consegue gerar uma página em `fingo.api.br` com nome de construtora, obra, valores e **telefone de WhatsApp** à escolha (vetor de golpe). Correção: gerar o link por um endpoint autenticado que assina o `pdata` com HMAC e validar a assinatura no servidor antes de exibir.

## Oitava rodada — links assinados do Portal do Cliente (X4)

Implementa a recomendação da sétima rodada, aprovada pelo responsável.

| Antes | Agora |
|---|---|
| `token` = `btoa("finobra_portal_<tenant>_<obra>")`, previsível e nunca verificado | Link assinado com HMAC-SHA256 pelo servidor (`api/_portal-link.js`), válido por 90 dias |
| Página pública exibia qualquer `pdata` da URL | `POST /api/v2/portal/verify` confirma assinatura e validade antes de exibir. Link alterado, sem assinatura ou vencido mostra "link não localizado ou expirou" |
| Nome, logo, telefone e responsável da construtora vinham do navegador | `POST /api/v2/portal/link` (com login e leitura em `obras`) força o tenant autenticado e preenche esses dados a partir do cadastro (`tenants`) |
| Link montado no navegador | Botões Copiar, WhatsApp e Visualizar pedem o link ao servidor. O WhatsApp da lista virou ação `PortalCliente.enviarWhatsAppLink` |

**Chave:** usa `PORTAL_LINK_SECRET` (mín. 32 caracteres) se existir; senão, uma chave derivada de `SESSION_SIGNING_SECRET` (link do portal nunca vale como sessão). Trocar `SESSION_SIGNING_SECRET` ou `PORTAL_LINK_SECRET` invalida os links já enviados.

**Efeito no deploy:** links do portal enviados antes desta versão param de abrir. A construtora precisa gerar e reenviar o link da obra.

## Nona rodada — privacidade, dependências e frontend restante

| # | Severidade | Problema | Correção |
|---|---|---|---|
| Y1 | 🟡 Média (LGPD) | O link do portal carregava o CPF/CNPJ do cliente e o valor financiado da obra, que a página não exibe. O link circula por WhatsApp e fica nos logs de acesso | Campos removidos no navegador e, por garantia, também ao assinar no servidor |

Revisado e sem problema:
- Service worker (`sw.js`) não guarda nenhuma resposta de `/api/` em cache.
- Não há listener de `postMessage` para outras origens (só `BroadcastChannel` entre abas da mesma origem).
- Nenhuma credencial é gravada em `localStorage`.
- Exportações Excel (`aoa_to_sheet`) gravam texto, sem risco de fórmula.
- Cabeçalhos de segurança aplicados em todo HTML: CSP com nonce, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- Endpoint MCP público só devolve texto institucional fixo.

### Dependências (`npm audit`)
- **Produção:** 0 vulnerabilidades (raiz e `backend/`).
- **Desenvolvimento:** 5 (3 altas, 2 moderadas), todas vindas do `wrangler@3` (`miniflare`/`undici@5`, `esbuild`, `sharp`). Afetam só a máquina de quem roda `wrangler dev`/deploy; não vão para o Worker publicado. **Recomendação:** atualizar para `wrangler@4` em uma tarefa separada, testando o deploy, porque é a ferramenta de publicação.

## Testes
- Novo: `scripts/test-audit-2026-10-02.js` (incluído em `npm test`). Cobre F1–F11 e R1–R5. Falha na versão anterior e passa na corrigida.
- Novo: `scripts/test-audit-2026-10-02-r3.js` (incluído em `npm test`). Cobre a terceira rodada.
- Novo: `scripts/test-audit-2026-10-02-r4.js` (incluído em `npm test`). Cobre a quarta rodada; suíte com 121 testes, mesmas duas falhas externas, nenhuma regressão.
- Novo: `scripts/test-audit-2026-10-02-r5.js` (incluído em `npm test`). Cobre a quinta rodada; suíte com 122 testes, mesmas duas falhas externas, nenhuma regressão.
- Novo: `scripts/test-audit-2026-10-02-r6.js` (incluído em `npm test`). Cobre a sexta rodada; suíte com 123 testes, mesmas duas falhas externas, nenhuma regressão.
- Novo: `scripts/test-audit-2026-10-02-r7.js` (incluído em `npm test`). Cobre a sétima rodada e confere os espelhos de `frontend/`; suíte com 124 testes, mesmas duas falhas externas, nenhuma regressão.
- Novo: `scripts/test-audit-2026-10-02-r8.js` (incluído em `npm test`). Cobre X4: assinatura, adulteração, validade, dados do cadastro e frontend; suíte com 125 testes, mesmas duas falhas externas, nenhuma regressão.
- Novo: `scripts/test-audit-2026-10-02-r9.js` (incluído em `npm test`). Cobre Y1; suíte com 126 testes, mesmas duas falhas externas, nenhuma regressão.
- Terceira rodada, suíte completa rodada teste a teste antes e depois: 118 de 119 → 119 de 120 (o novo passa). Falham igualmente nas duas versões, por dependerem de serviço externo: `test-phase5-edge-swr-cache.js` (API de CEP) e `test-upstash-redis-integration.js` (Redis real).
- Atualizados para o novo contrato:
  - `test-edge-v2-routes.js` e `test-review-remediation.js`: antes exigiam a lista fixa do SINAPI e o otimizador sem login.
- Comparação da suíte, antes e depois, em ambiente isolado: 126 testes, nenhuma regressão.
  - Parte dos testes não roda nesse ambiente porque depende de arquivos do frontend ou de pacotes (`pglite`) indisponíveis. Esses falham igualmente nas duas versões.
  - **Rode `npm test` localmente antes do commit.**
