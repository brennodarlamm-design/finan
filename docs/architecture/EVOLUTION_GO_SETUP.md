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

Para validar toda a camada de integração do conector sem precisar subir o container:

```bash
node scripts/test-evolution-go-adapter.js
```
