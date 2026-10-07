# FinGo auth.md — Autenticação para integrações e agentes de IA

Este documento descreve como integrações de máquina e agentes de IA se autenticam na plataforma **FinGo — Obras em Fluxo**. Ele lista apenas mecanismos que existem hoje na API.

---

## 1. Escopo

- **Domínio autoritativo:** `https://fingo.api.br`
- **Gateway de API:** `https://fingo.api.br/api`
- **Ambiente:** Cloudflare Workers + Neon Serverless Postgres.
- **Consulta pública sem login:** servidor MCP em `https://fingo.api.br/api/mcp` (informações de planos e cobertura SINAPI; não acessa dados de clientes).

O FinGo **não** é um provedor OAuth 2.0 / OpenID Connect completo: não há registro dinâmico de clientes, `client_credentials`, troca de tokens nem tokens assinados com chave pública. O acesso a dados de uma construtora sempre exige um usuário dessa empresa.

---

## 2. Login por usuário (sessão)

```http
POST /api/auth?action=login HTTP/1.1
Host: fingo.api.br
Content-Type: application/json
X-FinObra-Token-Mode: bearer

{
  "username": "usuario@empresa.com.br",
  "password": "********",
  "access_key": "<chave da empresa, quando exigida>"
}
```

- Navegadores recebem a sessão em cookie `HttpOnly` (`finobra_session_token`).
- Integrações enviam `X-FinObra-Token-Mode: bearer` para receber o campo `token` no corpo da resposta e passam a usar `Authorization: Bearer <token>`.
- Se a conta tiver 2FA, conclua o login com `POST /api/auth?action=mfa_verify`.
- O token é assinado com HMAC (HS256) pelo servidor e não pode ser verificado por terceiros. Por isso `/.well-known/jwks.json` não publica chaves.

## 3. Endpoints

| Ação | Endpoint | Método |
|---|---|---|
| Login | `/api/auth?action=login` | `POST` |
| Segundo fator (TOTP) | `/api/auth?action=mfa_verify` | `POST` |
| Sessão atual (usuário, perfil, permissões) | `/api/auth?action=me` | `GET` |
| Sessões ativas | `/api/auth?action=sessions` | `GET` |
| Encerrar sessão | `/api/auth?action=logout` | `POST` |
| Revogar outra sessão | `/api/auth?action=revoke_session` | `POST` |
| Solicitar acesso (nova empresa) | `/api/auth?action=register` | `POST` |
| Recuperação de senha | `/api/auth?action=request_reset` e `verify_reset` | `POST` |
| Metadados | `/.well-known/openid-configuration`, `/.well-known/oauth-protected-resource` | `GET` |

## 4. Permissões

O que um token pode fazer é definido pelo **perfil do usuário** na empresa (`admin`, `gestor`, `operador`, `visualizador`), pelas permissões por módulo configuradas pelo administrador e pelo plano contratado. Não há escopos OAuth por token. Use um usuário dedicado, com o menor perfil necessário, para cada integração.

## 5. Boas práticas e limites

1. **Rate limiting:** login, 2FA, recuperação de senha, IA e rotas públicas têm limites por IP e por empresa. Em HTTP 429, respeite o cabeçalho `Retry-After`.
2. **Mutações via cookie** exigem `Origin` do domínio oficial (proteção CSRF). Integrações com Bearer não dependem de `Origin`.
3. **Nunca** grave tokens em repositórios, logs ou URLs. Revogue sessões que não usa mais (`revoke_session`).
4. **HTTP 402 (x402):** a rota `/api/x402` anuncia requisitos de pagamento conforme o protocolo x402.
