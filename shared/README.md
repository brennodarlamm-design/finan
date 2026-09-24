# FinGo — Camada Compartilhada (Shared)

> **Fronteira Arquitetural:** Contratos de API, Definições de Banco de Dados e Schemas Comuns.

---

## 1. Conteúdo da Camada Compartilhada

```
shared/
├── contracts/                  # Contratos de Integração e Especificações
│   ├── openapi.json            # Especificação OpenAPI 3.0 de todas as rotas públicas do SaaS
│   ├── auth.md                 # Documento de referência do fluxo de autenticação e escopos
│   ├── llms.txt                # Índice conciso de documentação para agentes e LLMs
│   └── llms-full.txt           # Índice completo de documentação e endpoints
│
└── database/                   # Modelagem e Infraestrutura do Neon PostgreSQL
    ├── migrations/             # Migrações versionadas ordenadas (001 a 036)
    ├── schema.sql              # Snapshot de referência do schema completo
    └── client.js               # Conector padronizado para o pooler do Neon
```

---

## 2. Invariantes de Contratos e Banco de Dados

1. **Evolução de Schemas via Migrações:**
   - **NUNCA** altere tabelas diretamente em produção sem criar um arquivo `migrations/XXX_nome.sql`.
   - As migrações devem ser idempotentes (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
2. **Atualização da Especificação OpenAPI:**
   - Sempre que uma nova rota pública ou parâmetro for adicionado na API, atualize `shared/contracts/openapi.json`.
