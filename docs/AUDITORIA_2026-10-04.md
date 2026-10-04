# Auditoria FinGo — 04/10/2026 (segurança e melhorias do que já existe)

Escopo: melhorar o que já existe, sem funções novas. Quatro frentes analisadas em paralelo, com verificação no código atual e no banco de produção (somente leitura):
- APIs do servidor;
- app no navegador;
- rotinas automáticas e integrações;
- dependências, configuração e banco.

Os itens já corrigidos nas auditorias de 02/10 e 03/10 ficaram de fora.

**Banco de produção (verificado):**
- Todas as tabelas com `tenant_id` têm RLS ligado e forçado, com políticas.
- O papel da aplicação (`finobra_app`) não ignora o RLS.
- Os papéis públicos do Neon (`anonymous`/`authenticated`) não têm acesso às tabelas.

Legenda: 🔴 crítica · 🟠 alta · 🟡 média · 🔵 baixa · ✅ confirmado no código/banco · ❓ a confirmar

---

## Lote 1 — Urgente: acesso Master e cobrança

| # | Problema | Onde | |
|---|---|---|---|
| 1 | 🔴 MFA do superadmin contornável só com a senha. O login sem código devolve um token `mfa_pending`. O `mfa_setup` aceita esse token e gera um segredo novo, e o `mfa_activate` sobrescreve o MFA atual e entra no Master. | `api/auth.js:572, 837, 880-905` | ✅ |
| 2 | 🟠 O código de redefinição de senha vai para o WhatsApp da **empresa**, não da pessoa. Quem acessa o WhatsApp da construtora redefine a senha de qualquer usuário dela. Se o superadmin estiver numa empresa com outros admins, junto com o #1 isso vira tomada da conta Master. | `api/auth.js:1480, 1545` | ❓ |
| 3 | 🟡 Hash da senha do superadmin versionado no Git. Permite tentar descobrir a senha offline. | `migrations/023_*.sql`, `scripts/apply-migration-023.js` | ✅ |
| 4 | 🔴 A cobrança automática do SaaS não envia nenhum aviso. O driver do Neon devolve `DATE` como objeto `Date`, o código faz `String(...).split('-')`, e `diasRestantes` vira `NaN`. O recibo PIX mostra a data no formato "Sat Oct 10 2026…". | `backend/server.js:1326`, `api/_webhook_pix_core.js:390` | ✅ |
| 5 | 🔴 O resumo matinal de uma empresa sem telefone cadastrado vai para o telefone fixo de `TARGET_PHONE` (vazamento entre empresas). Ele também é enviado a empresas canceladas, não tem limite de tamanho e não tem idempotência. | `backend/server.js:1029-1068` | ✅ |
| 6 | 🟠 A varredura manual do Master: o fallback grava `pending_dispatch` (que nunca é enviado) e bloqueia o aviso real do ciclo. O clique manual ignora o anti-spam e reenvia avisos a todas as empresas. | `api/admin.js:371-437`, `backend/server.js:1345-1355` | ✅ |

**Ações que só uma pessoa pode fazer:**
- trocar a senha do superadmin depois do #1 e do #3;
- conferir em qual empresa o superadmin está (#2).

## Lote 2 — Injeção de HTML no app e isolamento de dados

| # | Problema | Onde | |
|---|---|---|---|
| 7 | 🟠 Campos gravados por qualquer usuário aparecem na tela sem escape: busca de obras, anexos, fases de documentos e prévias de exportação. Com o barramento `data-fb-*` (inclusive `mouseover`), um operador consegue fazer o admin criar uma conta admin. | `js/app.js:1267`, `js/documentos.js:401`, `js/fases_doc.js:255, 460`, `js/exportar_templates.js` | ✅ |
| 8 | 🟠 O XML de NF-e emitida por terceiros (nome do emitente) aparece na tela sem escape. | `js/nfe.js:1199, 1261`, `js/notas.js:334, 602` | ✅ |
| 9 | 🟠 Formulários de edição com `value="${…}"` e `<textarea>${…}` sem escape. O valor pode vir do MEMO de um PIX do extrato OFX. | `js/lancamentos.js:319-395`, `js/escritorio.js:369, 384`, `js/medicoes.js:384, 411` | ✅ |
| 10 | 🟡 O resultado do OCR (IA) aparece sem escape. | `js/ocr.js:446, 448, 557, 1139` | ✅ |
| 11 | 🔵 Há um segundo barramento de eventos (`data-od-*`) sem a proteção do portal público. | `js/obra_detalhe.js:3086-3210` | ✅ |
| 12 | 🟡 Uma política RLS pública em `document_signatures` (`codigo_validacao IS NOT NULL`) anula o isolamento por empresa dessa tabela, que guarda nome, documento e IP de quem assinou. | banco / `migrations/032` | ✅ |
| 13 | 🟡 O link do Portal do Cliente só exige leitura de `obras`, mas entrega despesas, medições, contratos e documentos. Assim contorna as permissões por módulo. | `api/_portal-link.js:151, 83-90` | ✅ |

## Lote 3 — Sincronização e dados errados

| # | Problema | Onde | |
|---|---|---|---|
| 14 | 🟠 O "Sincronizar tudo" e os workflows de obra não chegam aos outros aparelhos: o delta só olha `created_at` e `audit_logs`. | `api/_db-sync.js:673`, `api/_db-queries.js:107-131`, `api/_workflow*.js` | ✅ |
| 15 | 🟠 O sync-all faz 2 requisições ao banco por registro, em série, e estoura o tempo do Worker com milhares de registros. | `api/_db-sync.js`, `api/_sync-guard.js:74` | ✅ |
| 16 | 🟡 "Minhas Demandas" fica sempre vazia (`u.id` em vez de `u.userId`). | `js/minhas_demandas.js:33, 242` | ✅ |
| 17 | 🟡 "Gerar despesas" do orçamento duplica o contas a pagar no segundo clique. | `js/orcamentos.js:316, 1673` | ✅ |
| 18 | 🟡 Um clique duplo com anexo duplica a pré-compra ou a despesa do escritório. | `js/precompras.js:580-650`, `js/escritorio.js:522-575` | ✅ |
| 19 | 🟠 "Sincronizar com SEFAZ" mostra sucesso quando falha. O DF-e não tem trava contra consulta simultânea nem pausa depois de erro. ❓ No Worker, o `https.request` com `pfx` pode não enviar o certificado A1. | `js/nfe.js:938`, `api/_sefaz-dfe.js` | ✅/❓ |

## Lote 4 — Rotinas, infraestrutura e configuração

| # | Problema | Onde | |
|---|---|---|---|
| 20 | 🟠 A migração de documentos antigos pode travar a fila e gerar alerta CRÍTICO a cada 10 min, porque o intervalo mínimo entre alertas fica em memória. | `api/_edge-backup.js`, `api/_edge-alerts.js` | ✅ |
| 21 | 🟡 O backup R2 lê tabelas inteiras na memória (inclusive `base64_data`) e nada alerta quando falta o backup do dia. | `api/_edge-backup.js:49, 166` | ✅ |
| 22 | 🟡 Um erro de criptografia qualquer (AES-GCM) apaga as sessões de WhatsApp das empresas desconectadas. | `backend/server.js:367-391` | ✅ |
| 23 | 🟡 O robô SINAPI grava só 300 itens por UF e trava o processo do Render por minutos. | `backend/sinapi_robot.js:242, 295, 352` | ✅ |
| 24 | 🔵 Webhook de e-mail: não deduplica `svix-id`, o remetente "Nome <a@b>" não casa e aceita segredos de outros serviços. | `api/_webhook_email.js:52, 135, 163` | ✅ |
| 25 | 🟡 O `render.yaml` desfaz o `ORIGIN_ENFORCE_EDGE` (volta para `false`) e versiona um telefone real. | `render.yaml:20, 83, 97` | ✅ |
| 26 | 🟡 O workflow de PR expõe o token Cloudflare de produção ao `npm ci` e ao código do PR. Os previews não são apagados e o deploy de produção não pede aprovação. | `.github/workflows/cloudflare-pages-migration.yml`, `production-cicd.yml` | ✅ |
| 27 | 🟡 O `postinstall` roda o build de produção e reescreve arquivos versionados a cada `npm install`. | `package.json` | ✅ |
| 28 | 🟡 O CSP libera os hosts inteiros do cdnjs e do SheetJS, e as bibliotecas carregam sem SRI. `xlsx@0.20.0` e `jspdf@2.5.1` têm CVEs de ReDoS/DoS. | `cloudflare-worker.js:165`, `js/assets.js:4-6` | ✅ |
| 29 | 🔵 O app inteiro responde em `*.workers.dev`, fora das regras de WAF e limite de requisições da zona. | `wrangler.jsonc:7` | ✅ |

## Lote 5 — Ajustes menores

| # | Problema | Onde |
|---|---|---|
| 30 | 🔵 Trocar o próprio e-mail ou login não pede a senha atual nem encerra as outras sessões. | `api/users.js:742-820` |
| 31 | 🔵 Um `base64_data` enviado pelo sync não passa pela validação do `upload.js` antes de ir para o R2. | `api/_db-mutations.js:404`, `api/_db-sync.js:620` |
| 32 | 🔵 A newsletter não confirma o dono do e-mail, e qualquer pessoa descadastra terceiros. | `api/_v2-routes.js:432-470` |
| 33 | 🔵 Mensagens de erro internas são devolvidas ao cliente (DF-e, IA, `verificar_pdf`). | `api/nfe.js`, `api/_v2-routes.js`, `api/assinaturas.js` |
| 34 | 🔵 OCR v2: inventa dados quando a IA falha e usa muita memória com arquivos grandes. | `api/_edge-ai.js:91-146` |
| 35 | 🔵 O Sentry com Replay pesa 143 KB gzip em toda página, inclusive no login. | `js/sentry.js`, `scripts/sentry-entry.js:22` |
| 36 | 🔵 Dependências no grupo errado, `@sentry/node` sem uso na raiz e driver do Neon em versões diferentes. | `package.json`, `backend/package.json` |
| 37 | 🔵 Índices: falta `audit_logs (tenant_id, entidade, created_at)`; sobram índices de `lancamentos` sem `tenant_id`. | `migrations/` |
| 38 | 🔵 Restos sem uso: `vercel.json`, `js/recovery-account-ux.js`, `js/data_demo.js`. | raiz, `js/` |
| 39 | 🔵 Contrato preenche a parcela da Caixa com 75% da entrada sem avisar. | `js/contratos.js:797` |
| 40 | 🔵 Telefone e e-mail em texto aberto nos logs da cobrança, e o fetch do Resend não tem timeout. | `backend/server.js:1396, 1420, 1434` |

**A confirmar fora do código:**
- **Chave do Google Picker** (`js/gdrive.js:5`): conferir se está restrita por referrer a `fingo.api.br`.
- **Render:** com os dois serviços no plano grátis, o ping a cada 10 min pode estourar as 750 h do mês.
- **Trigger.dev:** se estiver implantado, o resumo das 08:00 sai em dobro.
- **Fuso de "hoje":** está fixo em Boa Vista (UTC-4). Avaliar se deve seguir o fuso do navegador ou da empresa.
