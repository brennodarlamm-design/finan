# Review completo — FinGo

**Repositório:** `brennodarlamm-design/finan`  
**Escopo:** frontend, APIs, Worker Cloudflare, backend Render/WhatsApp, banco/migrações SQL, workflows CI/CD e testes versionados.

> Esta revisão foi estática. O ambiente utilizado não tinha Node.js disponível, então não foi possível executar `npm test`, `node --check`, build ou testes E2E. Nenhuma alteração foi feita no código e nenhum deploy foi executado.

---

## Resumo executivo

O projeto tem uma boa base de segurança e uma arquitetura ambiciosa, mas foram mapeados **9 pontos relevantes**, incluindo:

- **2 problemas críticos de segurança**
- **5 problemas de alta prioridade**
- **2 problemas de média prioridade**

Os riscos mais importantes são:

1. A trilha de auditoria pode ser falsificada sem autenticação.
2. As rotas de IA estão públicas e sem limite de uso adequado.
3. Algumas APIs anunciadas como reais ainda retornam dados demonstrativos.
4. Existem pontos de possível XSS no frontend.
5. Há divergências no modelo de dados entre scripts legados e o banco em produção.

---

## Detalhamento dos problemas encontrados

### 1. Trilha de auditoria pode ser falsificada sem autenticação
- **Severidade:** 🔴 Crítica
- **Arquivo:** `api/_v2-routes.js` (em torno da linha 651)
- **Problema:** O endpoint `/api/v2/audit/ledger/append` aceita `tenantId` e `userId` diretamente do corpo da requisição sem verificar autenticação ou permissão. Qualquer usuário anônimo pode registrar eventos na trilha criptográfica, comprometendo a confiabilidade de auditorias.
- **Ação:** Exigir autenticação válida, vincular o evento ao usuário e tenant autenticados, restringir a ação a perfis autorizados e aplicar rate limit.

### 2. Rotas de IA expostas publicamente e sem quota de tenant
- **Severidade:** 🔴 Crítica
- **Arquivo:** `api/_v2-routes.js`
- **Problema:** As rotas `/api/v2/edge/ai/chat`, `/api/v2/edge/ai/ocr`, `/api/v2/edge/ai/semantic-search` e `/api/v2/financial/detect-anomaly` chamam Workers AI e Vectorize sem checagem de autenticação, sem rate limit e sem validação do plano do cliente.
- **Ação:** Exigir autenticação em todas as rotas de IA, validar se o plano contratado permite o recurso (ex.: OCR), aplicar rate limit por IP/tenant e validar tamanho dos payloads.

### 3. Dados demonstrativos (mock) em endpoints de produção
- **Severidade:** 🟠 Alta
- **Arquivo:** `api/_v2-routes.js`
- **Problema:** O endpoint `/api/v2/engineering/sinapi/export` devolve sempre uma lista fixa de 4 itens em vez de consultar a base real; `/api/v2/edge/sinapi/cached` usa dados estáticos no cache miss; `/api/v2/edge/ai/semantic-search` usa um catálogo fixo de 6 itens; e `/api/v2/edge/media/optimize` retorna um pixel PNG estático de 1x1.
- **Ação:** Conectar os endpoints às tabelas reais do banco (ex.: `sinapi_itens`) e ao storage R2 real, ou indicar claramente status de preview/indisponibilidade caso o recurso não esteja configurado.

### 4. Preferências corporativas expostas sem checagem de permissão (RBAC)
- **Severidade:** 🟠 Alta
- **Arquivo:** `api/_db-queries.js` (em torno das linhas 94 e 251)
- **Problema:** Em `handleDeltaSync` e `handleFullSnapshot`, a tabela `tenant_preferences` é consultada sem verificar se o perfil do usuário possui permissão de leitura no módulo `configuracoes`.
- **Ação:** Envolver a consulta em `tableAllowed(auth, 'preferencias', 'read')` e ocultar as preferências para perfis não autorizados.

### 5. Risco de XSS em modais de edição do frontend
- **Severidade:** 🟠 Alta
- **Arquivos:** `js/notas.js` (em torno da linha 210) e `js/fornecedores.js` (em torno da linha 320)
- **Problema:** Abertura de formulários interpola valores de campos (`value="${...}"`, `<textarea>${...}</textarea>`) diretamente em templates HTML sem passar por função de escape, permitindo quebra de atributo ou tag.
- **Ação:** Usar `Utils.escapeHtml()` em todas as interpolações de atributos e formulários.

### 6. Inconsistência de multi-tenant em upserts
- **Severidade:** 🟠 Alta
- **Arquivos:** `api/_db-mutations.js` e `api/_db-sync.js`
- **Problema:** Algumas tabelas usam `ON CONFLICT (tenant_id, id)` e outras usam `ON CONFLICT (id) DO UPDATE SET` sem validar se o registro pertence ao mesmo tenant.
- **Ação:** Adicionar `WHERE table.tenant_id = EXCLUDED.tenant_id` em todos os upserts com conflito em `(id)` para impedir sobrescrita indevida entre tenants.

### 7. Divergência estrutural no script de inicialização do banco
- **Severidade:** 🟠 Alta
- **Arquivo:** `scripts/setup-neon.js`
- **Problema:** O script cria tabelas com chave primária simples em `id` sem a coluna `tenant_id` em várias tabelas operacionais, gerando incompatibilidade com as migrações posteriores.
- **Ação:** Atualizar `scripts/setup-neon.js` para declarar `tenant_id VARCHAR(64) NOT NULL` nas tabelas operacionais e executar o pipeline de migrações.

### 8. Descompasso entre descoberta OIDC e modelo real de autenticação
- **Severidade:** 🟡 Média
- **Arquivo:** `cloudflare-worker.js` (em torno da linha 270)
- **Problema:** O arquivo publica metadados OIDC com endpoints que não existem na aplicação (ex.: `/api/auth?action=token`, fluxos `authorization_code`), quando a plataforma opera com login de sessão/cookie e API Keys.
- **Ação:** Adequar os metadados às rotas e fluxos realmente suportados.

### 9. Dependências e ferramentas de CI/CD sem versão fixada
- **Severidade:** 🟡 Média
- **Arquivos:** `.github/workflows/cloudflare-rollback.yml` e `.github/workflows/production-cicd.yml`
- **Problema:** Uso de `npx wrangler@latest` sem versão fixada pode quebrar o build repentinamente caso uma nova versão com breaking changes seja publicada.
- **Ação:** Fixar a versão do Wrangler nos workflows e no `package.json`.
