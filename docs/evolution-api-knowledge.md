# Evolution API — Knowledge Base para o FinGo

> **Fonte**: [docs.evolutionfoundation.com.br](https://docs.evolutionfoundation.com.br)
> **Atualizado**: 2026-09-27
> **Aplica-se a**: `finan-backend`, `fingo-evolution-go`, `evolution_client.js`

---

## 🏗️ Arquitetura da Plataforma

A Evolution Foundation oferece **dois motores** de WhatsApp:

| Motor | Tecnologia | Uso no FinGo |
|---|---|---|
| **Evolution API** | Node.js / TypeScript + Baileys | Motor legado (fallback) |
| **Evolution Go** | Golang, alta performance | Motor principal atual |

Ambos usam a **mesma estrutura de API REST** (rotas compatíveis), diferindo apenas na performance e nos detalhes de autenticação por instância.

---

## 🔑 Autenticação

### Evolution API (Node.js)
- Header: `apikey: <AUTHENTICATION_API_KEY>`
- A chave global é definida via `AUTHENTICATION_API_KEY` no `.env`
- Instâncias individuais podem ter tokens próprios (campo `token` no `/instance/create`)

### Evolution Go (Golang)
- Header: `apikey: <API_KEY>` (mesmo padrão)
- A variável de ambiente é `API_KEY` (não `AUTHENTICATION_API_KEY`)
- **⚠️ Diferença crítica**: O container Go usa `API_KEY`, não `AUTHENTICATION_API_KEY`

### API EvoAI (serviços de IA/CRM)
- Header: `api_access_token: <TOKEN_UUID>`
- Base URL: `https://api.evoai.app`

---

## 📦 Variáveis de Ambiente — Evolution API (completas)

### Server
| Variável | Descrição | Exemplo |
|---|---|---|
| `SERVER_TYPE` | Tipo do servidor | `http` |
| `SERVER_PORT` | Porta | `8080` |
| `SERVER_URL` | URL pública do servidor (usada em webhooks internos) | `https://meudominio.com` |

### Autenticação
| Variável | Descrição | Exemplo |
|---|---|---|
| `AUTHENTICATION_API_KEY` | Chave global da API | `429683C4C977415CAAFCCE10F7D57E11` |
| `AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES` | Exibe instâncias no fetch | `true` |

### Banco de Dados
| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_ENABLED` | Habilita persistência | `true` |
| `DATABASE_PROVIDER` | `postgresql` ou `mysql` | `postgresql` |
| `DATABASE_CONNECTION_URI` | URI de conexão | `postgresql://user:pass@host/db` |
| `DATABASE_CONNECTION_CLIENT_NAME` | Nome para isolar instalações | `evolution_fingo` |

### Dados a Salvar
| Variável | Padrão recomendado |
|---|---|
| `DATABASE_SAVE_DATA_INSTANCE` | `true` |
| `DATABASE_SAVE_DATA_NEW_MESSAGE` | `true` |
| `DATABASE_SAVE_MESSAGE_UPDATE` | `true` |
| `DATABASE_SAVE_DATA_CONTACTS` | `true` |
| `DATABASE_SAVE_DATA_CHATS` | `true` |
| `DATABASE_SAVE_DATA_LABELS` | `true` |
| `DATABASE_SAVE_DATA_HISTORIC` | `true` |

### Webhook Global
| Variável | Descrição |
|---|---|
| `WEBHOOK_GLOBAL_ENABLED` | Habilita webhook global |
| `WEBHOOK_GLOBAL_URL` | URL receptora |
| `WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS` | Habilita por evento |

### Eventos de Webhook (todos boolean)
```
WEBHOOK_EVENTS_QRCODE_UPDATED
WEBHOOK_EVENTS_MESSAGES_UPSERT
WEBHOOK_EVENTS_MESSAGES_UPDATE
WEBHOOK_EVENTS_MESSAGES_DELETE
WEBHOOK_EVENTS_SEND_MESSAGE
WEBHOOK_EVENTS_CONTACTS_SET / _UPSERT / _UPDATE
WEBHOOK_EVENTS_PRESENCE_UPDATE
WEBHOOK_EVENTS_CHATS_SET / _UPSERT / _UPDATE / _DELETE
WEBHOOK_EVENTS_GROUPS_UPSERT / _UPDATE
WEBHOOK_EVENTS_GROUP_PARTICIPANTS_UPDATE
WEBHOOK_EVENTS_CONNECTION_UPDATE      ← crítico para QR Code e status
WEBHOOK_EVENTS_CALL
WEBHOOK_EVENTS_ERRORS / _ERRORS_WEBHOOK
```

### QR Code
| Variável | Descrição | Exemplo |
|---|---|---|
| `QRCODE_LIMIT` | Duração em segundos | `30` |
| `QRCODE_COLOR` | Cor do QR | `#175197` |

### Cache / Redis
| Variável | Descrição |
|---|---|
| `CACHE_REDIS_ENABLED` | Habilita Redis |
| `CACHE_REDIS_URI` | `redis://localhost:6379/6` |
| `CACHE_REDIS_PREFIX_KEY` | Prefixo isolador |
| `CACHE_REDIS_SAVE_INSTANCES` | Salva credentials no Redis |
| `CACHE_LOCAL_ENABLED` | Cache em memória (alternativa ao Redis) |

### Logs
| Variável | Descrição |
|---|---|
| `LOG_LEVEL` | `ERROR,WARN,DEBUG,INFO,LOG,VERBOSE,DARK,WEBHOOKS` |
| `LOG_COLOR` | Colorir logs |
| `LOG_BAILEYS` | Nível de log do Baileys |

### Integrações Disponíveis
| Variável | Integração |
|---|---|
| `CHATWOOT_ENABLED` | Chatwoot CRM |
| `OPENAI_ENABLED` | OpenAI |
| `DIFY_ENABLED` | Dify AI |
| `TYPEBOT_API_VERSION` | Typebot |
| `RABBITMQ_ENABLED` | RabbitMQ (filas de eventos) |
| `WEBSOCKET_ENABLED` | WebSocket real-time |
| `SQS_ENABLED` | Amazon SQS |
| `S3_ENABLED` | S3 / MinIO |

---

## 📦 Variáveis de Ambiente — Evolution Go

O container Golang (`evoapicloud/evolution-go:latest`) usa um subconjunto diferente:

| Variável | Descrição | Status no FinGo |
|---|---|---|
| `API_KEY` | Chave de acesso global | ✅ Configurada (set 2026-09-27) |
| `WEBHOOK_URL` | URL para receber eventos | ✅ Configurada (set 2026-09-27) |
| `PORT` | Porta interna (default: 8085) | Render gerencia automaticamente |

> **⚠️ CRÍTICO**: O container Go usa `API_KEY` (não `AUTHENTICATION_API_KEY`).
> O `finan-backend` envia `apikey: <EVOLUTION_GO_API_KEY>` e esse valor
> **deve ser idêntico** ao `API_KEY` configurado no container `fingo-evolution-go`.

---

## 🛣️ Rotas Principais

### Instâncias
```
GET    /instance/all                    → lista todas as instâncias
POST   /instance/create                 → cria instância
POST   /instance/connect                → conecta (gera QR)
GET    /instance/connect/:name          → obtém QR Code
GET    /instance/connectionState/:name  → status da conexão
DELETE /instance/logout/:name           → desconecta graciosamente
DELETE /instance/delete/:name           → remove instância
POST   /instance/restart/:name          → reinicia instância
```

### Mensagens
```
POST   /send/text                       → envia texto (Evolution Go)
POST   /message/sendText/:instance      → envia texto (Evolution API)
POST   /message/sendMedia/:instance     → envia mídia
```

### QR Code
```
GET    /instance/qr                     → QR Code da instância ativa
GET    /instance/:name/qrcode           → fallback legado
```

### Webhooks
```
POST   /webhook/set/:instance           → configura webhook
GET    /webhook/find/:instance          → obtém configuração
```

### Saúde
```
GET    /                    → healthcheck básico (retorna 200)
GET    /server/ok           → Evolution Go healthcheck
GET    /health              → alternativa
```

---

## 📋 Payload de Criação de Instância

### Evolution API (Node.js)
```bash
POST /instance/create
apikey: <AUTHENTICATION_API_KEY>

{
  "instanceName": "nome_tenant",
  "integration": "WHATSAPP-BAILEYS",
  "qrcode": true,
  "webhook": "https://meudominio.com/webhook"
}
```

### Evolution Go (Golang) ← nosso motor atual
```bash
POST /instance/create
apikey: <API_KEY>

{
  "name": "nome_tenant",
  "token": "token_nome_tenant_123",
  "qrcode": true,
  "webhook": "https://meudominio.com/webhook"
}
```

> **Diferença de campo**: Evolution API usa `instanceName`, Evolution Go usa `name`.
> Nosso `evolution_client.js` já usa `name`. ✅

---

## 📡 Payloads de Webhook

### `qrcode.updated`
```json
{
  "event": "qrcode.updated",
  "instance": "nome_tenant",
  "data": {
    "qrcode": "data:image/png;base64,...",
    "pairingCode": "ABC-DEF"
  }
}
```

### `connection.update`
```json
{
  "event": "connection.update",
  "instance": "nome_tenant",
  "data": {
    "state": "open",
    "number": "5511999999999"
  }
}
```
Estados possíveis: `open` (conectado), `connecting`, `close` (desconectado)

### `messages.upsert`
```json
{
  "event": "messages.upsert",
  "instance": "nome_tenant",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "MSG_ID"
    },
    "message": { "conversation": "Texto da mensagem" },
    "pushName": "Nome do Contato",
    "messageTimestamp": 1234567890
  }
}
```

---

## 🔄 Atualização do Container

### Via Docker (recomendado)
```bash
# Pull da nova versão
docker pull evoapicloud/evolution-go:latest

# Recriar container
docker compose down && docker compose up -d
```

### Via Render API (nosso ambiente)
```bash
# Trigger redeploy (usado pelo FinGo)
POST https://api.render.com/v1/services/{serviceId}/deploys
Authorization: Bearer <RENDER_API_KEY>
{ "clearCache": "do_not_clear" }
```

> **Para produção**: sempre fixar versão (`v2.1.1`), nunca `latest`.
> No Render Free tier isso não é crítico pois a imagem fica no cache.

---

## 🏗️ Fluxo de Dados FinGo

```
Browser/App
    ↓ HTTPS
Cloudflare Worker (Edge)
    ↓ x-api-key: <INTERNAL_API_SECRET>
finan-backend (Render — Node.js)
    ├── evolutionGo.isConfigured()? (checar API_KEY)
    │         ↓ POST apikey: <EVOLUTION_GO_API_KEY>
    │   fingo-evolution-go (Render — Docker/Go)
    │         ↓ POST WEBHOOK_URL ao receber eventos
    └── /api/whatsapp?action=webhook
         ↓ parseWebhookPayload()
    Processa: QR Code, status conexão, mensagens recebidas
```

### Variáveis por serviço no Render

**finan-backend** (`srv-dak05l8jo6nc73fh98cg`):
- `EVOLUTION_GO_URL` = `https://fingo-evolution-go.onrender.com`
- `EVOLUTION_GO_API_KEY` = `<chave_compartilhada>`
- `EVOLUTION_GO_WEBHOOK_URL` = `https://fingo.api.br/api/whatsapp?action=webhook`
- `INTERNAL_API_SECRET` = `<secret_cloudflare>` ← sincronizado com Worker
- `SESSION_SIGNING_SECRET` = `<secret_sessão>`

**fingo-evolution-go** (`srv-dart4pnpn0mc73dufvcg`):
- `API_KEY` = `<mesma_chave_compartilhada>` ← configurada em 2026-09-27
- `WEBHOOK_URL` = `https://fingo.api.br/api/whatsapp?action=webhook` ← configurada em 2026-09-27

---

## 🐛 Problemas Conhecidos e Soluções

### QR Code não aparece
1. Verificar se `fingo-evolution-go` está rodando → `GET /server/ok`
2. Verificar `API_KEY` definida no container Go (estava faltando até 2026-09-27)
3. Circuit breaker pode estar `OPEN` após 3 falhas → esperar 30s ou `resetCircuit()`
4. Cold-start no Render Free (~30s) → a rota `/qr` retorna `warmingUp: true`

### 401 Unauthorized ao chamar Evolution Go
- `EVOLUTION_GO_API_KEY` no `finan-backend` difere do `API_KEY` no container Go
- Solução: sincronizar via `scripts/sync-cloudflare-secrets.js` ou Render Dashboard

### Webhook não dispara eventos
- `WEBHOOK_URL` ausente ou incorreta no container `fingo-evolution-go`
- URL precisa ser publicamente acessível (HTTPS)
- Checar se eventos estão selecionados na configuração da instância

### Circuit Breaker aberto (503)
- Threshold: 3 falhas consecutivas → abre por 30 segundos
- Reset automático após cooldown
- Reset manual: `evolutionGo.resetCircuit()`
- Verificar saúde: `evolutionGo.checkHealth()`

---

## 📈 Melhorias Implementadas (2026-09-27)

| Melhoria | Arquivo | Status |
|---|---|---|
| Rota `/qr` delegada ao Evolution Go com `getUnifiedSessionSummary` | `backend/server.js` | ✅ |
| Estado `warmingUp` propagado para o frontend | `frontend/whatsapp.js` | ✅ |
| `API_KEY` configurada no `fingo-evolution-go` no Render | Render Dashboard | ✅ |
| `WEBHOOK_URL` configurada no `fingo-evolution-go` | Render Dashboard | ✅ |
| Secrets `INTERNAL_API_SECRET` sincronizados | `sync-cloudflare-secrets.js` | ✅ |
| Circuit Breaker com fallback gracioso | `evolution_client.js` | ✅ |

## 📈 Melhorias Pendentes Identificadas

| Melhoria | Prioridade | Descrição |
|---|---|---|
| `webhook_by_events: true` na criação | Alta | Configurar eventos específicos ao criar instância |
| Timeout maior no `getQrCode` | Média | 5000ms para cold-start do Render |
| Healthcheck antes de requisições | Média | Usar `/server/ok` antes de `/instance/all` |
| Logging de eventos webhook | Alta | Log estruturado com tenant e tipo de evento |
| Retry com backoff exponencial | Baixa | Substituir circuit breaker simples por retry inteligente |

---

## 🔗 Referências

- [Variáveis de Ambiente](https://docs.evolutionfoundation.com.br/evolution-api/configuration/env)
- [Instalação](https://docs.evolutionfoundation.com.br/evolution-api/installation)
- [Atualização](https://docs.evolutionfoundation.com.br/evolution-api/updates)
- [API Reference](https://docs.evolutionfoundation.com.br/api-reference/introduction)
- [Evolution Go API](https://docs.evolutionfoundation.com.br/evolution-go/get-all-instances)
- [Repositório oficial](https://github.com/evolution-foundation/evolution-api)
- [.env.example oficial](https://github.com/evolution-foundation/evolution-api/blob/main/.env.example)
