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

---

## Correções aplicadas

**Lote 1 (04/10/2026)**, coberto por `scripts/test-auditoria-2026-10-04.js`, que roda o handler real de autenticação sobre um Postgres em memória:
- ✅ #1 `mfa_setup` só aceita o token de primeira configuração e só quando o MFA está desligado. Trocar o autenticador exige sessão Master verificada mais o código atual ou um código de backup. O `mfa_activate` nunca sobrescreve um MFA ativo fora dessa troca autorizada.
- ✅ #2 Confirmado no banco: o superadmin está na empresa "angelim", que tem outro admin, e o e-mail cadastrado dele é inválido.
  - O código de redefinição vai para o e-mail da própria pessoa. O WhatsApp da empresa só é usado para quem não tem e-mail válido, e nunca para a conta Master.
  - A conta Master também precisa do Google Authenticator (ou de um código de backup) para concluir a redefinição. A tela de login pede esse código.
- ✅ #3 O hash foi removido da migração 023 e o `apply-migration-023.js` foi desativado (ele também desligava o MFA do Master). O scanner de segredos passou a barrar hashes `salt:hash`. **O hash continua no histórico do Git: troque a senha do superadmin.**
- ✅ #4 A varredura de cobrança e o recibo PIX leem `vencimento::text`. O teste demonstra o problema com o parser real do driver do Neon.
- ✅ #5 Resumo matinal:
  - sem o fallback para `TARGET_PHONE`, exceto no teste manual do próprio tenant padrão;
  - empresas canceladas ou arquivadas ficam de fora;
  - no máximo 20 itens, com total e quantidade;
  - uma vez por dia por empresa (`billing_notifications_sent`, estágio `daily_summary`).
- ✅ #6 Varredura manual do Master:
  - sem o Render, nada é marcado como enviado, e a resposta passa a ser 503 com a mensagem real;
  - uma varredura demorada aparece como "em andamento";
  - o anti-spam conta só `status = 'sent'`;
  - o clique manual geral respeita o anti-spam; só o teste de uma empresa força o reenvio.

**Ações para uma pessoa:**
1. Trocar a senha do superadmin.
2. Cadastrar um e-mail válido na conta Master (hoje ela não consegue receber o código de redefinição).
3. Avaliar mover o superadmin para uma empresa técnica, sem outros usuários.

**Empresa do superadmin (04/10/2026, a pedido):** criada a empresa `fingo-master` ("FinGo Teste (Master)", plano unlimited, sem vencimento e sem telefone, portanto fora da cobrança automática e do resumo matinal). O superadmin foi movido para ela e está sozinho nessa empresa. As sessões dele foram encerradas, então é preciso entrar de novo. Os usos de `angelim` no código se referem ao WhatsApp que envia as mensagens da plataforma e não mudaram.

**Lote 2 (04/10/2026)**
- ✅ #7 Campos de usuário passaram a ser exibidos como texto:
  - busca de obras;
  - anexos;
  - fases de documentos (com links via `Utils.safeUrl`);
  - todas as exportações: dentro de `ExportarTemplates.gerar()`, o `DB` é um proxy que devolve cópias com os textos escapados.
- ✅ #8 e #10 NF-e (emitente, número, CNPJ), prévia de XML em Notas e resultado do OCR escapados.
- ✅ #9 Todos os `value="${…}"` e `<textarea>${…}</textarea>` dos módulos do app passaram a ser escapados (147 pontos em 23 arquivos), sem escape em dobro onde o valor já vinha escapado. O teste falha se aparecer um novo sem escape.
- ✅ #11 Barramentos de eventos:
  - os eventos passivos (passar o mouse, foco, sair do campo) só chamam as 8 ações de estilo/CEP permitidas;
  - o `data-od-*` não roda no portal público e, no mouse, só aplica o realce de borda.
- ✅ #12 Migração `040`: remove a política pública de `document_signatures`. A validação pública usa `validar_assinatura_publica(código)` e o registro usa `codigo_assinatura_status(...)`, as duas funções SECURITY DEFINER. Testado com RLS e o papel da aplicação. Até a migração ser aplicada, a API cai na consulta antiga. **Aplicar a 040 no banco.**
- ✅ #13 O link do portal leva, assinado, o escopo de quem o gerou (módulos que essa pessoa pode ler), e o portal só entrega esses módulos. Mexer no escopo invalida o link. Links v2 antigos continuam até expirar (90 dias).

**Lote 3 (05/10/2026)**
- ✅ #14 O "Sincronizar tudo" registra em `audit_logs`, num único INSERT (`writeAuditBatch`), o id de cada registro gravado. Os workflows de obra marcam a obra alterada (`marcarAlteracao`). Assim o delta dos outros aparelhos passa a receber essas alterações. O teste confere com a mesma consulta do delta.
- ✅ #15 As versões (`xmin`) de cada tabela são lidas numa consulta só (`prefetchSyncVersions`), em vez de uma por registro: 300 registros passaram de ~600 para 305 consultas. A gravação em lote dos próprios registros fica para uma etapa futura.
- ✅ #16 "Minhas Demandas" e as notificações de workflow usam o `userId` da sessão.
- ✅ #17 "Gerar despesas" do orçamento:
  - guarda os lançamentos por etapa (`despesas_por_etapa`) e acumula os vínculos;
  - etapas já geradas pedem confirmação antes de duplicar;
  - um clique duplo não gera em dobro.
- ✅ #18 Pré-compra e despesa do escritório: um salvamento por vez, enquanto o anexo é lido.
- ✅ #19 SEFAZ:
  - `success:false` aparece como erro;
  - trava atômica (uma consulta por vez e no máximo uma a cada 2 min);
  - pausa de 15 min depois de erro ou de resposta inesperada;
  - `cUFAutor` vem da UF da empresa;
  - o `dfe_sync` é encaminhado pelo Worker ao Render, que envia o certificado A1 no TLS.
- ✅ Extra: cinco confirmações com `<strong>`/`<br>` mostravam as tags como texto, porque o `Utils.confirm` escapa a mensagem. Elas passaram a usar `allowHtml` (os dados interpolados já eram escapados).

**Lote 4 (05/10/2026)**
- ✅ #20 A migração de documentos antigos para o R2 roda uma vez por dia (07:20 UTC) em vez de a cada 10 min, com ordem que muda a cada dia (documentos que falham não travam a fila). Acaba o alerta crítico a cada 10 min.
- ✅ #21 Backup:
  - `documentos` sem `base64_data`;
  - `audit_logs` só com os últimos 90 dias;
  - checagem às 08:00 UTC dispara um alerta se o manifesto do dia não existir.
- ✅ #22 Erro de decifragem não tratado só é registrado; não apaga mais as sessões de WhatsApp.
- ✅ #23 Robô SINAPI:
  - grava todos os itens (antes, 300 por UF), em lotes de 500;
  - lê a linha das UFs uma vez por planilha;
  - devolve a vez ao event loop entre as UFs.
- ✅ #24 Webhook de e-mail:
  - só o segredo próprio (ou a assinatura Svix);
  - id derivado do `svix-id` com `ON CONFLICT DO NOTHING`;
  - remetente "Nome <email>" casado corretamente.
- ✅ #25 `render.yaml`: `ORIGIN_ENFORCE_EDGE` = `"true"` e `TARGET_PHONE` como `sync: false` (sem telefone versionado).
- ✅ #26 Workflows:
  - o token da Cloudflare só no passo de deploy do preview;
  - `npm ci --ignore-scripts`;
  - wrangler travado no lock;
  - o preview é apagado quando o PR fecha;
  - o deploy de produção usa `environment: production`. **Configure revisores obrigatórios no GitHub** (Settings → Environments → production).
- ✅ #27 O build gera o bundle do Sentry só em `dist/js/sentry.js`, e o `npm install` deixa de reescrever arquivos versionados. O `postinstall` foi mantido, porque não dá para confirmar daqui se o build da Cloudflare depende dele.
- ✅ #28 Bibliotecas:
  - JSZip 3.10.1, jsPDF 3.0.4 (corrige CVE-2025-29907/57810), pdf.js 4.2.67 e three.js r128 servidos de `/js/vendor`, testados no Chromium;
  - o CSP não libera mais o cdnjs (`script-src` e `worker-src`);
  - xlsx atualizado para 0.20.3 (CVE-2024-22363), ainda pelo `cdn.sheetjs.com`, porque esse host é bloqueado na rede deste ambiente. Copiar o arquivo para `/js/vendor` depois e tirar o host do CSP.
- ✅ #29 O Worker de produção, acessado por `*.workers.dev`, redireciona as páginas para `fingo.api.br` e recusa a API (os previews de PR continuam acessíveis).

**Migrações pendentes (verificado em `schema_migrations` e na existência das tabelas):**

> ⚠️ Correção de 05/10: esta verificação foi feita no projeto Neon `blue-thunder-76323603` (sa-east-1, `ep-solitary-river`), que é o banco antigo, hoje usado pelo WhatsApp. O banco do SaaS é o `ep-flat-fire-b4qu9c7p` (us-east-2, ver `docs/architecture/NEON_DUAL_WORKLOAD_SPLIT.md`), que fica em outra conta Neon e ainda não foi conferido. A empresa de teste do superadmin (`fingo-master`) também foi criada no banco antigo.

- `033` (newsletter);
- `034` (anti-duplicidade de faturas pendentes);
- `037` (Central de E-mails: a tabela `email_messages` não existe, e o webhook de e-mail falha hoje);
- `038` (verificação de assinaturas ICP);
- `039` (OFX);
- `040` (assinaturas sem leitura pública).

### Lote 5 (em andamento)

- ✅ #30 Para trocar o próprio e-mail ou login é preciso informar a senha atual. Depois da troca, as outras sessões são encerradas.
- ✅ #31 O `base64` de documentos enviado pelo `save` e pelo "Sincronizar tudo" passa pela mesma política do `/api/upload`, em `api/_file-validation.js`. A política verifica:
  - extensão e MIME permitidos;
  - extensão executável oculta;
  - limite de 15 MB;
  - assinatura binária;
  - ausência de HTML/script.
  
  Um arquivo recusado não é gravado. Os metadados do documento seguem, e o app mantém a cópia local. Efeito colateral: os contratos e recibos gerados em HTML deixam de ter cópia na nuvem, porque HTML é bloqueado como no `/api/upload`. Eles continuam no aparelho e podem ser gerados de novo.

