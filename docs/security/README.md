# FinGo — Arquitetura de Segurança e Mapeamento Ponta a Ponta

> **Documento Oficial de Segurança da Informação, Governança e Compliance**  
> **Versão:** 2.40.6 — Setembro/2026  
> **Status:** Ativo / Auditado  
> **Classificação:** Confidencial / Técnico

---

## 1. Filosofia de Segurança e Princípios Fundamentais

O ecossistema **FinGo** adota uma abordagem de **Defesa em Profundidade (*Defense-in-Depth*)** e **Falha Fechada (*Fail-Closed*)**. Nenhum componente confia cegamente no outro; a validação ocorre em todas as camadas da requisição: Borda (Cloudflare) -> Transporte (TLS 1.3) -> Aplicação (Worker/Serverless/Container) -> Banco de Dados (PostgreSQL RLS).

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DEFESA EM PROFUNDIDADE FINGO                               │
│                                                                                             │
│  [ CLIENTE (Browser / App) ]                                                                │
│        │  • CSP Estrita (script-src-attr 'none', sem inline handlers)                       │
│        │  • Barramento Declarativo data-fb-* (patch26-events.js)                             │
│        │  • Escape HTML Rigoroso em todas as interpolações (Utils.escapeHtml)                │
│        ▼                                                                                    │
│  [ CLOUDFLARE EDGE (WAF / Worker) ]                                                         │
│        │  • Fail2Ban Distribuído no Cloudflare KV (bloqueio progressivo de IPs maliciosos)   │
│        │  • Headers HSTS, nosniff, SAMEORIGIN, Permissions-Policy                           │
│        │  • Isolamento de Anexos no Cloudflare R2 (URLs pré-assinadas com TTL curto)        │
│        ▼                                                                                    │
│  [ CAMADA DE APLICAÇÃO (APIs Serverless / Render Container) ]                               │
│        │  • Autenticação Híbrida: Cookie HttpOnly + Bearer Tokens                           │
│        │  • Resolução de Tenant Online (resolveAuthAndTenant com verificação no Neon)        │
│        │  • Matriz RBAC Fail-Closed (api/_permissions.js: superadmin, admin, gestor...)      │
│        │  • Timing-Safe Comparators (crypto.timingSafeEqual em webhooks, tokens e senhas)    │
│        ▼                                                                                    │
│  [ BANCO DE DADOS (Neon PostgreSQL Serverless) ]                                             │
│        │  • Conexão runtime de menor privilégio: role finobra_app (NOBYPASSRLS)             │
│        │  • Contexto de Tenant por Transação: app.current_tenant_id (_tenant-sql.js)        │
│        │  • Políticas FORCE ROW LEVEL SECURITY (RLS) em 100% das tabelas de negócio         │
│        │  • Queries e Mutações parametrizadas (imunização total a SQL Injection)            │
│        └────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Modelagem de Ameaças (STRIDE Matrix)

| Ameaça (STRIDE) | Vetor Potencial | Controles e Mitigações Implementados | Status |
| :--- | :--- | :--- | :--- |
| **Spoofing** (Falsificação de Identidade) | Roubo de sessão, falsificação de usuário ou adulteração de cabeçalho `x-tenant-id`. | Hashing `scrypt` com salt de 16B e chave de 64B; Tokens JWT com HMAC-SHA256; Cookie `HttpOnly` com flag `SameSite=Lax` e `Secure`; Resolução de tenant vinculada ao registro do usuário no banco (`resolveAuthAndTenant`), rejeitando adulteração de tenant por clientes comuns. | **Mitigado** |
| **Tampering** (Adulteração de Dados) | Injeção de SQL em mutações; Alteração de parâmetros de contrato ou medição de outro tenant. | Queries 100% parametrizadas via tagged template; Isolamento multi-tenant duplo: cláusula explícita `WHERE tenant_id = $X` + RLS a nível de engine (`app.current_tenant_id`); Mutações com predicados defensivos em `_db-mutations.js`. | **Mitigado** |
| **Repudiation** (Repúdio) | Negação de operações financeiras críticas, alterações de contratos ou exclusões de obras. | Trilha de auditoria estruturada (`audit_events` e `tenant_integrity_audit`) registrando `user_id`, `tenant_id`, `ip`, `resource`, `action` e `changes_jsonb`; Assinaturas digitais com carimbo de tempo. | **Mitigado** |
| **Information Disclosure** (Vazamento de Dados) | Exposição de credenciais em URLs; Vazamento de stack traces SQL em respostas de erro; Acesso cruzado a anexos. | Eliminação completa de segredos via query string (rejeitados em `_auth.js` e `_webhook_pix_core.js`); Tratamento uniforme de exceções que oculta `err.message` interna; Bucket R2 com prefixos obrigatórios `tenants/{tenantId}/` validados no servidor. | **Mitigado** |
| **Denial of Service** (Negação de Serviço) | Ataques de força bruta no login/MFA; Sobrecarga de endpoints de OCR ou importação SINAPI; Flood de webhooks. | Fail2Ban lógico no Edge com pontuação progressiva e banimentos de 5m a 24h; Limite distribuído de requisições em `api_rate_limits`; Limite de tamanho de payload no Worker (12MB–22MB); Circuit Breaker com jitter no frontend para resiliência de rede. | **Mitigado** |
| **Elevation of Privilege** (Elevação de Privilégio) | Usuário operador manipulando perfil para admin; Bypass de RBAC via envio de campos proibidos. | RBAC fail-closed em `api/_permissions.js`: módulos não mapeados retornam negação imediata; Permissões customizadas JSONB apenas **restringem** privilégios, nunca elevam além da regra do perfil base; Perfil é resolvido online no Neon a cada requisição. | **Mitigado** |

---

## 3. Gestão de Identidade, Autenticação e Sessões (IAM)

### 3.1 Armazenamento Criptográfico de Senhas
- **Algoritmo:** `scrypt` com memória e CPU balanceadas (salt aleatório de 16 bytes, chave derivada de 64 bytes gerada via `crypto.scryptSync`).
- **Formato Persistido:** `<salt_hex>:<derived_key_hex>` na coluna `usuarios.senha_hash`.
- **Comparação:** Realizada estritamente com `crypto.timingSafeEqual` para imunizar o sistema contra ataques de temporização (*timing attacks*).

### 3.2 Tokens e Sessões
- **Credencial Primária Web:** Cookie `finobra_session_token` configurado com:
  - `HttpOnly: true` (inacessível a scripts no navegador).
  - `Secure: true` (trafegado exclusivamente via HTTPS).
  - `SameSite: Lax` (proteção nativa contra Cross-Site Request Forgery).
- **Compatibilidade API/Mobile:** Suporte a cabeçalhos `Authorization: Bearer <token>` e `x-api-key`.
- **Validação Online em Tempo Real:** Toda requisição passa por `resolveAuthAndTenant()`, que executa busca no banco para validar se o usuário continua ativo (`u.ativo = true`), se o tenant não foi cancelado/expirado e se a sessão não foi revogada (`auth_sessions.revoked_at IS NULL`).

### 3.3 Autenticação de Dois Fatores (2FA / TOTP)
- Baseada na norma **RFC 6238** (Time-Based One-Time Password) com janela de 30 segundos e SHA-1.
- Segredos TOTP (`mfa_secret`) são cifrados com **AES-256-GCM** antes da gravação no banco, utilizando a chave `MFA_ENCRYPTION_KEY`.
- Códigos de backup descartáveis (*backup codes*) com hash irreversível.
- Proteção contra reutilização do mesmo passo de tempo (`mfa_last_used_step`).

### 3.4 Recuperação Segura de Conta
- Tabela `recuperacao_senhas` armazena códigos com hash (`codigo_hash`).
- Limite estrito de no máximo **3 tentativas incorretas** por solicitação (`max_tentativas = 3`).
- Validade temporal curta (15 minutos).
- Desativação atômica no primeiro uso (`usado = true`).

---

## 4. Multi-Tenancy e Isolamento de Dados

### 4.1 Fronteira de Conexão com o Banco de Dados (Dual Boundary)
O FinGo adota duas credenciais de conexão distintas com o Neon PostgreSQL:
1. `DATABASE_URL`: Utilizada pelo **runtime da aplicação** no atendimento a usuários comuns. Conecta-se como o role de privilégio mínimo `finobra_app` (`NOBYPASSRLS`). Qualquer tentativa do pool de usar um usuário com privilégio `owner` é bloqueada na inicialização por `api/_database.js`.
2. `DATABASE_OWNER_URL`: Utilizada **exclusivamente** durante bootstrap, migrações DDL e rotinas administrativas que operam em múltiplos tenants.

### 4.2 Contexto de Tenant por Transação (`_tenant-sql.js`)
Como o driver HTTP do Neon opera de forma stateless (sem manter estado de sessão entre queries):
```javascript
// A cada transação/operação de dados:
SET LOCAL app.current_tenant_id = '<tenant_id_autenticado>';
-- Execução da query da aplicação
```
O terceiro parâmetro `true` (`SET LOCAL`) restringe a configuração ao ciclo de vida da transação atual, impedindo contaminação de contexto entre requisições simultâneas.

### 4.3 Políticas de Segurança de Nível de Linha (RLS)
Todas as tabelas de dados de negócio possuem `ALTER TABLE <tabela> ENABLE ROW LEVEL SECURITY;` e `ALTER TABLE <tabela> FORCE ROW LEVEL SECURITY;`. As políticas aplicadas são estruturadas no padrão:
```sql
CREATE POLICY tenant_isolation_policy ON <tabela>
  AS RESTRICTIVE
  FOR ALL
  TO finobra_app
  USING (tenant_id = current_setting('app.current_tenant_id', true));
```
**Defesa em Profundidade:** Mesmo com RLS forçado pelo PostgreSQL, o código da aplicação em `_db-queries.js` e `_db-mutations.js` mantém explicitamente a cláusula `WHERE tenant_id = $1` em todas as instruções SQL.

---

## 5. Matriz de Controle de Acesso Baseado em Papéis (RBAC)

O arquivo `api/_permissions.js` rege todas as decisões de autorização com a regra **Fail-Closed** (negação por padrão):

| Perfil | Leitura | Escrita | Exclusão | Gerenciar Usuários | Alterar Empresa | Ver Auditoria |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **superadmin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **gestor** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **operador** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **visualizador** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### Regras de Ouro do RBAC:
1. **Módulos não Mapeados:** Se uma tabela ou rota não estiver explicitamente catalogada em `TABLE_MODULES`, o acesso é sumariamente bloqueado (`canAccessTable` retorna `false`).
2. **Permissões Customizadas:** O JSONB de permissões customizadas do usuário (`u.permissoes`) só pode **restringir** acessos (`false`). Ele nunca pode conceder permissões que o perfil base não autoriza.
3. **Hierarquia Invariante:** Sem leitura não há escrita; sem escrita não há exclusão.

---

## 6. Segurança de Borda, WAF e Perímetro (Cloudflare Edge)

### 6.1 Content Security Policy (CSP Estrita)
Injetada dinamicamente pelo `cloudflare-worker.js`:
- `script-src-attr 'none'`: Proíbe 100% de manipuladores inline no DOM (`onclick`, `onload`, `onsubmit`, etc.).
- `default-src 'self'`: Restringe carregamentos à mesma origem.
- `object-src 'none'`: Desativa plugins e applets obsoletos.
- `frame-ancestors 'self'`: Impede ataques de *Clickjacking* por inclusão em iframes de terceiros.
- `form-action 'self'`: Garante que formulários só façam submit para a própria aplicação.

### 6.2 Cabeçalhos de Segurança HTTP
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`: Força HTTPS por 1 ano.
- `X-Content-Type-Options: nosniff`: Previne sniffing de MIME-type.
- `X-Frame-Options: SAMEORIGIN`: Bloqueia enquadramento externo.
- `Referrer-Policy: strict-origin-when-cross-origin`: Minimiza vazamento de referrers.
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`: Desativa sensores desnecessários.

### 6.3 Fail2Ban de Borda e Rate Limiting
- Integrado ao Cloudflare KV via `api/_edge-security.js`.
- Rastreia tentativas maliciosas por IP (login inválido, violações de formato, requisições repetidas).
- Ao atingir 5 falhas na janela de 10 minutos, o IP é banido por 30 minutos com emissão de alerta operacional automático via `dispatchEdgeAlert`.

---

## 7. Criptografia e Proteção de Segredos

| Ativo Protegido | Algoritmo Criptográfico | Chave / Mecanismo | Armazenamento |
| :--- | :--- | :--- | :--- |
| **Certificados Digitais A1 (NFe/CTe)** | AES-256-GCM com IV de 12 bytes e Auth Tag de 16 bytes | `CERT_ENCRYPTION_KEY` | `tenant_certificates.cert_pfx_base64_enc` |
| **Senhas de Usuários** | `scrypt` (16B salt, 64B derived key) | Salt aleatório por registro | `usuarios.senha_hash` |
| **Segredos TOTP / 2FA** | AES-256-GCM | `MFA_ENCRYPTION_KEY` | `usuarios.mfa_secret` |
| **Assinatura de Webhooks PIX** | HMAC-SHA256 comparado via `timingSafeEqual` | `PIX_WEBHOOK_SECRET` | Validado nos headers HTTP |
| **Tokens de Sessão (JWT)** | HMAC-SHA256 (HS256) | `SESSION_SIGNING_SECRET` | Cookie HttpOnly / Header Bearer |
| **IP Ban Indexing** | HMAC-SHA256 | `IP_BAN_PEPPER` | `security_ip_state.ip_hash` (não armazena IP plano) |

---

## 8. Segurança no Frontend e Blindagem do DOM

1. **Barramento de Eventos Declarativo (`data-fb-*`):**  
   Desenvolvido em `frontend/core/patch26-events.js`, o frontend não utiliza nenhum handler HTML inline. Toda interação dispara eventos capturados por delegação no `document`:
   ```html
   <!-- Permitido e auditado -->
   <button data-fb-click="Lancamentos.salvar" data-fb-click-n="1">Salvar</button>
   ```
2. **Sanitização Universal contra XSS (`Utils.escapeHtml`):**  
   Qualquer dado dinâmico interpolado em templates literais passa obrigatoriamente por escape de caracteres perigosos (`&`, `<`, `>`, `"`, `'`).
3. **Isolamento de Cache Local (IndexedDB):**  
   A base local no IndexedDB é particionada por `tenant_id`. Ao trocar de usuário ou deslogar, os stores de dados em memória e de cache local são expurgados imediatamente.

---

## 9. Proteção em Integrações Externas

1. **SEFAZ DF-e & Certificados ICP-Brasil:**  
   O processamento de certificados `.pfx` ocorre **exclusivamente em memória**, sem gravar arquivos temporários em disco. A comunicação SOAP com o WebService da SEFAZ utiliza mTLS com a cadeia ICP-Brasil.
2. **Robô SINAPI (Caixa / IBGE):**  
   O endpoint `/api/sinapi/robot/run` exige autenticação administrativa rigorosa via `requireAuth` e segredo interno em header, impedindo acionamentos não autorizados.
3. **Webhooks PIX:**  
   Protegidos contra ataques de repetição (*replay attacks*) por controle de idempotência na coluna `billing_invoices.txid` e validação estrita de assinatura no header.

---

## 10. Governança de CI/CD e Invariantes de Deploy (AGENTS.md)

1. **Sequência Obrigatória:**  
   `Implementação -> Testes (npm test) -> Commit Semântico -> Push Remoto -> Deploy Cloudflare Pages`.
2. **Proibição Absoluta do Vercel:**  
   O deploy em produção é feito com exclusividade no Cloudflare Pages (`npm run build:cloudflare && npm run deploy:cloudflare`). O Vercel está banido para produção.
3. **Limite de 12 Funções Públicas (Vercel Hobby Invariant):**  
   A pasta `api/` na raiz mantém estritamente no máximo 12 endpoints públicos de nível superior, multiplexando todas as demais rotas em arquivos internos prefixados com `_`.

---

## 11. Histórico de Auditorias e Status de Conformidade

- **Última Auditoria Concluída:** Setembro/2026
- **Status Geral da Suíte de Testes:** **100% de Aprovação (Zero Falhas)**
- **Total de Patches Validados:** 56 Patches cumulativos com suíte de regressão estática e testes de integração sintéticos ativos.
