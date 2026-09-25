# FinGo — Guia de Configuração e Ativação do Evolution Go (Golang)

> **Documento de Operação e Infraestrutura**  
> **Status:** Ativo  
> **Referência Oficial:** [Documentação do Evolution Foundation](https://docs.evolutionfoundation.com.br/evolution-go/installation)  
> **Imagem Docker Oficial:** `evoapicloud/evolution-go:latest`

---

## 1. Visão Geral

O **Evolution Go** é o novo motor de integração com o WhatsApp desenvolvido em **Golang (Go)** e baseado na biblioteca **`whatsmeow`** (`go.mau.fi/whatsmeow`).

### Principais Benefícios em Relação ao Baileys Anterior:
* **Consumo de Memória Reduzido:** De ~500 MB (Node.js) para **~50 MB (Golang)**.
* **Persistência Transacional:** As credenciais e sessões de WhatsApp são gravadas de forma nativa e segura no **PostgreSQL (Neon)**, eliminando perdas de sessão ao reiniciar o container no Render.
* **Eliminação de Erros de Bad MAC:** O `whatsmeow` possui controle estrito de chaves criptográficas Signal, evitando desconexões silenciosas.
* **Transição com Zero Downtime:** O FinGo implementa fallback automático: se o Evolution Go não estiver configurado no ambiente, o sistema utiliza o motor legado sem quebrar nenhuma funcionalidade.

---

## 2. Como Rodar Localmente com Docker

1. Copie o arquivo de exemplo de variáveis:
   ```bash
   cp .env.evolution-go.example .env.evolution-go
   ```

2. Suba o container com o Docker Compose dedicado:
   ```bash
   docker compose -f docker-compose.evolution-go.yml up -d
   ```

3. Verifique a saúde do serviço:
   ```bash
   curl http://localhost:8085/
   ```

4. Documentação interativa Swagger:
   Abra no navegador: `http://localhost:8085/swagger/index.html`

---

## 3. Como Implantar em Produção (Render)

Você pode rodar o Evolution Go no Render criando um serviço dedicado:

1. No painel do Render, clique em **New +** > **Web Service**.
2. Selecione **Deploy an existing image**.
3. Em **Image URL**, informe:
   ```text
   evoapicloud/evolution-go:latest
   ```
4. Configure as Variáveis de Ambiente no Render:
   * `SERVER_PORT`: `8080`
   * `CLIENT_NAME`: `fingo`
   * `GLOBAL_API_KEY`: *(gere uma chave secreta e forte)*
   * `POSTGRES_AUTH_DB`: `postgresql://[USER]:[PASS]@[NEON-ENDPOINT].neon.tech/neondb?sslmode=require`
   * `POSTGRES_USERS_DB`: `postgresql://[USER]:[PASS]@[NEON-ENDPOINT].neon.tech/neondb?sslmode=require`
   * `DATABASE_SAVE_MESSAGES`: `false`
   * `CONNECT_ON_STARTUP`: `true`
   * `WADEBUG`: `INFO`
   * `LOGTYPE`: `console`
   * `WEBHOOK_URL`: `https://api.fingo.api.br/api/whatsapp?action=webhook`

---

## 4. Como Ativar o Evolution Go no FinGo

Basta configurar duas variáveis no backend do FinGo ([`backend/server.js`](file:///d:/Projects/FINAN%C3%87AS/backend/server.js) ou no painel de Environment do Render):

```env
# URL do seu serviço Evolution Go
EVOLUTION_GO_URL=https://seu-evolution-go.onrender.com

# Mesma chave definida em GLOBAL_API_KEY
EVOLUTION_GO_API_KEY=sua-chave-secreta-forte
```

Assim que essas variáveis forem detectadas:
1. O endpoint `/whatsapp-session` consultará o estado e QR Code diretamente do Evolution Go.
2. O endpoint `/send-message` despachará mensagens via Evolution Go com fallback automático.
3. O endpoint `/reset-auth` limpará e recriará a sessão do tenant no motor em Go.
4. Se as variáveis forem removidas ou estiverem vazias, o FinGo reverte imediatamente para o Baileys local sem qualquer impacto para o usuário.

---

## 5. Testes e Validação Automatizada

Para validar toda a camada de integração do conector, parsing de webhooks e invariantes do servidor:

```bash
node scripts/test-evolution-go-adapter.js
```

---

## 6. Arquitetura de Webhooks (Inbound Events)

O Evolution Go emite webhooks HTTP em tempo real quando ocorrem alterações na conexão, atualização de QR code ou chegada de novas mensagens.

### Endpoints Receptores no FinGo:
* **Backend Render 24/7:** `POST /webhook/evolution-go` (e alias `/api/webhook-whatsapp`)
* **Proxy Serverless / Edge:** `POST /api/whatsapp?action=webhook`

### Autenticação do Webhook:
O Evolution Go deve enviar a chave de segurança configurada em `GLOBAL_API_KEY` através do header `apikey` ou `Authorization: Bearer <token>`.

### Eventos Processados:
1. `qrcode.updated`:
   - Atualiza o cache de QR Code na sessão do tenant sem atraso de sondagem (polling).
2. `connection.update`:
   - Atualiza o status da conexão (`connected`, `disconnected`, `connecting`) instantaneamente na memória e banco de dados.
3. `messages.upsert`:
   - Extrai o remetente, texto ou mídia da mensagem recebida para exibição ou roteamento.

### Como Simular um Webhook Localmente:
```bash
curl -X POST http://localhost:3333/webhook/evolution-go \
  -H "Content-Type: application/json" \
  -H "apikey: sua-chave-secreta-forte" \
  -d '{
    "event": "connection.update",
    "instance": "public",
    "data": { "state": "open", "number": "5595991363678" }
  }'
```

---

## 7. Cache Redis & Mensageria de Alta Performance (Upstash Redis TLS)

Conforme a [Documentação Oficial do Evolution Foundation sobre Redis](https://docs.evolutionfoundation.com.br/evolution-api/requirements/redis), o Redis atua como a camada de alta performance para instâncias, cache de mensagens e mensageria distribuída.

### Parâmetros Oficiais de Configuração:
```env
# Ativa o cache em Redis
CACHE_REDIS_ENABLED=true

# URI TLS com autenticação (Upstash exige rediss:// ou --tls na porta 6379)
CACHE_REDIS_URI=rediss://default:SEU_TOKEN_UPSTASH@better-wallaby-298903.upstash.io:6379

# Prefixo de chave para segregação no Redis compartilhado
CACHE_REDIS_PREFIX_KEY=evolution_fingo

# Salvar metadados de instâncias no Redis
CACHE_REDIS_SAVE_INSTANCES=false

# Cache local em memória (desativado quando Redis distribuído está ativo)
CACHE_LOCAL_ENABLED=false

# URI compatível com clientes Go/Queue
REDIS_URL=rediss://default:SEU_TOKEN_UPSTASH@better-wallaby-298903.upstash.io:6379
```

### Upstash Redis REST no FinGo (Edge & Backend):
O FinGo disponibiliza os módulos [`api/_edge-redis.js`](file:///d:/Projects/FINAN%C3%87AS/api/_edge-redis.js) e [`backend/domains/integrations/upstash_redis.js`](file:///d:/Projects/FINAN%C3%87AS/backend/domains/integrations/upstash_redis.js):
- **Ultra-baixa latência (<10ms):** opera via HTTPS REST puro, funcionando tanto no Node.js quanto em Cloudflare Pages / Workers sem requerer sockets TCP nativos.
- **Deduplicação de Webhooks:** através de `redisSetNx(msgId, 1, 60)`, previne disparos e processamentos repetidos de mensagens em cluster.
- **Rate-Limiting Atômico:** através de `checkRateLimitRedis(key, limit, windowSeconds)`.

---

## 8. Integração com Upstash MCP (Model Context Protocol)

O Upstash disponibiliza um servidor remoto oficial de MCP no endpoint:
`https://mcp.upstash.com/mcp`

### Configuração no Antigravity / Claude / Cursor:
O arquivo [`.agents/mcp_config.json`](file:///d:/Projects/FINAN%C3%87AS/.agents/mcp_config.json) já está preparado no repositório:
```json
{
  "mcpServers": {
    "upstash": {
      "url": "https://mcp.upstash.com/mcp",
      "headers": {
        "Authorization": "Bearer ${UPSTASH_API_KEY}"
      }
    }
  }
}
```
Isso permite que assistentes de IA realizem diagnósticos em tempo real, auditoria de métricas e gerenciamento dos recursos Redis e Vector diretamente pelo protocolo MCP.


