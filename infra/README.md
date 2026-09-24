# FinGo — Infraestrutura & DevOps (Infra)

> **Fronteira Arquitetural:** Gateways, Servidores de Produção, Configurações de Nuvem e Automações.

---

## 1. Topologia de Produção

O FinGo opera em arquitetura híbrida de nuvem com alta disponibilidade:

```
                  ┌──────────────────────────────────────────┐
                  │          USUÁRIO / NAVEGADOR             │
                  └────────────────────┬─────────────────────┘
                                       │ HTTPS
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │       CLOUDFLARE EDGE & PAGES            │
                  │  • Assets estáticos (dist/)              │
                  │  • CDN global e WAF anti-DDoS            │
                  │  • Cloudflare Worker (cloudflare-worker) │
                  │  • Storage de Anexos R2                  │
                  │  • Roteamento inteligente de APIs        │
                  └────────────┬─────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │ Proxy /api/*                        │ Banco Direto
            ▼                                     ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐
│        RENDER CLOUD          │        │       NEON POSTGRESQL        │
│ • Servidor Express contínuo  │───────>│ • Serverless Postgres        │
│ • WhatsApp Engine (Baileys)  │        │ • Connection Pooler          │
│ • Robô de Automação SINAPI   │        │ • Row Level Security (RLS)   │
│ • Webhooks e Processamento   │        │ • Autoscaling & Backup       │
└──────────────────────────────┘        └──────────────────────────────┘
```

---

## 2. Invariantes de Deploy

1. **Destino Frontend:** Cloudflare Pages (`npm run build:cloudflare && npm run deploy:cloudflare`).
2. **Destino Backend:** Render (`finan-backend`).
3. **Proibição Absoluta do Vercel:** Não executar deploys na Vercel (regra inegociável do `AGENTS.md`).
4. **Ordem de Operações:** Testes (`npm test`) -> Commit -> Push -> Deploy.
