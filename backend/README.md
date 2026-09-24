# FinGo — Camada de Backend (Monólito Modular)

> **Fronteira Arquitetural:** APIs REST, Serviços de Domínio e Banco de Dados  
> **Servidor Principal (Render):** `backend/server.js`  
> **Banco de Dados:** Neon Serverless PostgreSQL com Connection Pooling  
> **Padrão de Execução:** Node.js 18+ com Express e roteamento modular.

---

## 1. Organização dos Módulos de Domínio no Backend

```
backend/
├── server.js                   # Servidor Express contínuo no Render (WhatsApp + Cron + APIs)
├── Dockerfile                  # Imagem container para produção
├── package.json                # Dependências dedicadas do serviço de backend
│
└── domains/                    # Serviços e Regras de Negócio por Domínio
    ├── auth/                   # Autenticação e Autorização
    │   ├── _auth.js            # Validação de credenciais, emissão e verificação de JWT
    │   ├── _totp.js            # Autenticação de dois fatores (RFC 6238)
    │   ├── _permissions.js     # Matriz de controle de acesso baseado em papéis (RBAC)
    │   └── _cargos.js          # Definição e restrição de perfis funcionais
    │
    ├── fiscal/                 # Serviços Tributários e Fiscais
    │   ├── _sefaz-dfe.js       # Cliente SOAP para o WebService Nacional da SEFAZ
    │   ├── _certificado.js     # Parser criptográfico de certificados digitais A1 (.pfx/.p12)
    │   └── nfe.js              # Roteador de emissão, consulta e manifesto de notas
    │
    ├── financeiro/             # Processamento Financeiro e Faturamento
    │   ├── _webhook_pix.js     # Validação de assinatura e processamento atômico de PIX
    │   ├── _plans.js           # Catálogo oficial de planos, cotas e limites SaaS
    │   └── plano.js            # Rotas de checkout, status e upgrade de assinatura
    │
    ├── obras/                  # Motor de Workflow e Engenharia
    │   ├── _workflow.js        # Máquina de estados de avanço de etapas de obra
    │   ├── _workflow-stage-update.js # Atualização atômica de responsáveis e prazos
    │   └── _sla.js             # Motor de cálculo e monitoramento de SLAs contratuais
    │
    ├── database/               # Camada de Acesso a Dados Neon PostgreSQL
    │   ├── _database.js        # Pooler client padronizado com SSL obrigatório
    │   ├── _db-mutations.js    # Mutações com isolamento multi-tenant defensivo
    │   ├── _db-queries.js      # Consultas projetadas com otimização de egress
    │   └── _db-sync.js         # Sincronização delta bidirecional com o cliente
    │
    ├── edge/                   # Adapters e Serviços de Borda (Cloudflare)
    │   ├── _edge-adapter.js    # Ponte entre Cloudflare Worker Request e handlers Node
    │   ├── _edge-security.js   # WAF de aplicação, rate limiting e bloqueio de IPs
    │   ├── _edge-r2.js         # Storage de documentos com Cloudflare R2
    │   └── _edge-alerts.js     # Canal operacional de alertas críticos
    │
    └── integrations/           # Integrações Externas e Automação
        ├── sinapi_robot.js     # Robô coletor das tabelas oficiais SINAPI (Caixa/IBGE)
        ├── _ai-key-pool.js     # Pool balanceado de chaves Gemini para inteligência
        └── whatsapp.js         # API de mensageria via Baileys WhatsApp
```

---

## 2. Invariantes de Desenvolvimento no Backend

1. **Isolamento Multi-Tenant Estrito:**
   - **TODA** operação de leitura ou escrita no banco de dados deve obrigatoriamente incluir a cláusula `tenant_id = $X`.
   - É proibido realizar `SELECT *` sem filtro de tenant.
2. **Tratamento de Concorrência e Idempotência:**
   - Webhooks (como PIX) devem verificar se o identificador de transação (`txid` ou `e2e_id`) já foi processado antes de mutar saldos.
3. **Ponte de Compatibilidade com `api/`:**
   - A pasta `api/` na raiz é mantida como interface pública de rotas para assegurar compatibilidade contínua com Cloudflare Pages, Worker e a suíte de testes de regressão estática.
