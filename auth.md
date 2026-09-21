# FinGo auth.md — Autenticação e Registro de Agentes de IA

Este documento especifica os mecanismos de autenticação, provisionamento de identidade e governança para agentes autônomos de IA e integrações de máquina interagindo com a plataforma **FinGo — Obras em Fluxo**.

---

## 1. Audiência & Escopo do Agente

- **Público-alvo:** Agentes autônomos de IA, assistentes LLM (Claude, ChatGPT, Perplexity, Copilot), sistemas de automação de compras de construção civil e serviços de ERP/Backoffice.
- **Domínio Autoritativo:** `https://fingo.api.br`
- **Gateway de API:** `https://fingo.api.br/api`
- **Ambiente:** Produção Edge (Cloudflare Workers + Neon Serverless Postgres).

---

## 2. Métodos de Autenticação Suportados

Os agentes podem se autenticar no FinGo utilizando os seguintes métodos:

### 2.1. Bearer Token (JWT / OAuth 2.0)
- **Cabeçalho:** `Authorization: Bearer <token>`
- **Obtenção:** Via endpoint de token OAuth (`POST /api/auth?action=token`) ou login de serviço.
- **Validade:** Tokens de acesso expiram em 12 horas; utilize refresh tokens para renovação contínua.

### 2.2. API Key de Tenant (`x-api-key`)
- **Cabeçalho:** `x-api-key: <fingo_live_...>` ou `authorization: Bearer <fingo_live_...>`
- **Cabeçalho Adicional Obrigatório:** `x-tenant-id: <uuid-do-tenant>`
- **Uso:** Integrações máquina-a-máquina com escopo restrito às permissões do tenant.

### 2.3. Asserção de Identidade (ID-JAG & Verified Email)
- **Token Type:** `urn:ietf:params:oauth:token-type:id-jag`
- **Verificação:** Conforme RFC de Asserção de Identidade OAuth para agentes que operam em nome de usuários verificados.

---

## 3. Endpoints de Registro & Provisionamento

| Ação | Endpoint | Método | Descrição |
|---|---|---|---|
| **Registro de Agente** | `/api/auth?action=agent-register` | `POST` | Provisiona credenciais dinâmicas para um novo agente |
| **Obtenção de Token** | `/api/auth?action=token` | `POST` | Troca de credenciais ou autorização por Access Token |
| **Verificação de Sessão** | `/api/auth?action=me` | `GET` | Retorna o usuário, perfil e permissões associadas |
| **Claim Anônimo** | `/api/auth?action=anonymous-claim` | `POST` | Solicita sessão efêmera de consulta pública |
| **Catálogo de Descoberta** | `/.well-known/oauth-authorization-server` | `GET` | Metadados de autorização OAuth 2.0 (RFC 8414) |

---

## 4. Escopos de Permissão (Scopes)

Os agentes devem solicitar apenas o conjunto mínimo de permissões necessárias (*least privilege*):

- `read`: Consulta a dados cadastrais e entidades do tenant.
- `write`: Criação e edição de transações, lançamentos e orçamentos.
- `finance`: Gestão de contas bancárias, conciliação e fluxo de caixa.
- `construction`: Gestão de canteiro, medições físicas e insumos SINAPI.
- `openid`, `profile`, `email`: Identidade federada do operador humano responsável.

---

## 5. Práticas de Segurança & Rate Limiting

1. **Assinatura de Requisições:** Para tráfego de bots em larga escala, assine as requisições utilizando Web Bot Auth (RFC 9421) com chaves públicas publicadas em `/.well-known/http-message-signatures-directory`.
2. **Proteção Contra Abuso:** O Edge aplica rate-limiting adaptativo (120 req/min por IP/agente em rotas de API padrão). Em caso de HTTP 429, respeite o cabeçalho `Retry-After`.
3. **Desafio HTTP 402 (x402):** Operações que demandam micropagamentos ou consumo de créditos retornam status HTTP 402 com as instruções de liquidação em USDC/Base no header `PAYMENT-REQUIRED`.

---

## 6. Fluxo Completo de Registro e Autenticação (Self-Contained Registration Flow)

Agentes autônomos podem se registrar e obter tokens de acesso de forma 100% autônoma através dos passos abaixo:

### Passo 1: Registro Dinâmico do Agente (Dynamic Client Registration)

```http
POST /api/auth?action=agent-register HTTP/1.1
Host: fingo.api.br
Content-Type: application/json

{
  "client_name": "Autonomous Agent",
  "redirect_uris": ["https://agent.example.com/callback"],
  "grant_types": ["client_credentials", "urn:ietf:params:oauth:grant-type:token-exchange"],
  "response_types": ["token"],
  "scope": "read write finance construction",
  "token_endpoint_auth_method": "client_secret_post"
}
```

Resposta esperada (HTTP 201 Created):

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "client_id": "fingo_agent_live_01",
  "client_secret": "fingo_sec_live_abcdef123456",
  "client_id_issued_at": 1716300000,
  "client_secret_expires_at": 0,
  "registration_client_uri": "https://fingo.api.br/api/auth?action=agent-register"
}
```

### Passo 2: Obtenção de Token de Acesso (Token Exchange)

```http
POST /api/auth?action=token HTTP/1.1
Host: fingo.api.br
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "fingo_agent_live_01",
  "client_secret": "fingo_sec_live_abcdef123456",
  "scope": "read finance"
}
```

Resposta esperada (HTTP 200 OK):

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "access_token": "fingo_tok_eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 43200,
  "scope": "read finance"
}
```

### Passo 3: Asserção de Identidade / Claim

```http
POST /api/auth?action=claim HTTP/1.1
Host: fingo.api.br
Content-Type: application/json

{
  "grant_type": "urn:ietf:params:oauth:grant-type:token-exchange",
  "subject_token": "eyJhbGciOi...",
  "subject_token_type": "urn:ietf:params:oauth:token-type:id-jag",
  "requested_token_type": "urn:ietf:params:oauth:token-type:access_token"
}
```

