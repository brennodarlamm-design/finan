# FinObra — Documentação e Arquitetura do Sistema

Este diretório centraliza a documentação técnica, manuais de arquitetura e histórico de evolução do FinObra SaaS.

---

## 📁 Estrutura de Documentação

* **[Histórico de Patches & Migrações](history/):**
  * [`CLOUDFLARE_MIGRATION.md`](history/CLOUDFLARE_MIGRATION.md): Arquitetura de migração de edge computing para Cloudflare Workers e Pages com redundância Vercel.
  * [`DOMAIN_CUTOVER.md`](history/DOMAIN_CUTOVER.md): Procedimentos e gates de segurança para o cutover do domínio `finobra.app.br`.
  * [`LOADING_PERFORMANCE.md`](history/LOADING_PERFORMANCE.md): Otimizações de latência inicial, lazy-loading de módulos de engenharia e renderização SPA.
  * [`SYNC_RELIABILITY.md`](history/SYNC_RELIABILITY.md): Protocolo de sincronização bidirecional offline-first entre IndexedDB e Neon PostgreSQL.
  * [`VISUAL_REDESIGN.md`](history/VISUAL_REDESIGN.md): Especificações de design system, paleta de cores corporativa e diretrizes de usabilidade mobile-first.

---

## 🏛️ Visão Geral da Arquitetura

1. **Frontend (SPA Vanilla / CSP Estrita):**
   * Sem dependências pesadas de framework para carregamento instantâneo.
   * Política CSP rígida (`script-src-attr 'none'`) sem handlers inline (`data-fb-*` event bridge em `js/patch26-events.js`).
   * Armazenamento local robusto em IndexedDB (`js/data.js`).

2. **Backend Serverless & 24/7 Service:**
   * **Vercel / Cloudflare Edge:** Micro-APIs serverless em `/api/*` com pooling Neon PostgreSQL.
   * **Render Container (Docker):** Serviço de retaguarda contínua em `backend/server.js` para integração SEFAZ, WhatsApp Baileys e cron jobs.
   * **Robô SINAPI (`backend/sinapi_robot.js`):** Ingestão automática em lote das 27 UFs do Brasil e 24 bases de preço da engenharia civil.

3. **Banco de Dados (Neon Serverless PostgreSQL):**
   * Multi-tenancy com isolamento por `tenant_id` e RLS.
   * Versionamento por migrações em `migrations/`.
