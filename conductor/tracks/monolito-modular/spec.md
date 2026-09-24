# Trilha Conductor: Monólito Modular FinGo (spec.md)

> **Contexto Conductor**  
> **Trilha:** `monolito-modular`  
> **Status:** Ativo  
> **Data:** 2026-09-24  
> **Responsável:** Antigravity AI  

---

## 1. Problema e Motivação

O repositório do FinGo acumulou grande densidade de arquivos nas pastas de primeiro nível:
1. **Raiz Desordenada:** Arquivos de logs temporários, scripts duplicados e relatórios estavam na raiz ao lado de arquivos vitais de infraestrutura.
2. **Mistura de Preocupações:** Arquivos HTML de marketing/landing (`landing.html`, `planos.html`, `calculadora-bdi.html`, etc.) estavam misturados com as shells autenticadas da aplicação SaaS (`app.html`, `master.html`, `bim.html`).
3. **Frontend Flat (`js/`):** Mais de 50 scripts na pasta `js/` sem divisão por domínio de negócio, dificultando a navegação e a manutenibilidade para novas features.
4. **Backend Fragmentado:** Lógica distribuída entre `backend/server.js`, 56 arquivos na pasta `api/` e `cloudflare-worker.js`.

---

## 2. Objetivos da Trilha

1. **Estrutura por Pastas Funcionais no Monólito:**
   - `frontend/`: Código do SaaS, Design Tokens e módulos de negócio.
   - `backend/`: Código de servidor, APIs, integrações e jobs.
   - `marketing/`: Páginas públicas, landing, blog, manuais e ferramentas de aquisição.
   - `shared/`: Migrações SQL, contratos OpenAPI e schemas.
   - `infra/` e `scripts/`: Ferramentas de automação, testes e deploy.
   - `docs/`: Documentação arquitetural, relatórios e metodologias (Conductor).

2. **Zero Regressão e Zero Downtime:**
   - A transição deve ser fásica e segura.
   - Criação de **pontes de compatibilidade (*facades / re-exports*)** para que nenhum dos 161 testes existentes ou pipelines de deploy no Cloudflare Pages e Render sejam interrompidos.

3. **Governança e Manutenções Futuras:**
   - Criação de padrões e templates para novos módulos.
   - Documentação de regras de arquitetura e isolamento multi-tenant.

---

## 3. Critérios de Aceite

- [x] Raiz limpa de logs e artefatos soltos (`.log`, relatórios antigos organizados em `docs/reports/`).
- [x] Documento de arquitetura `docs/architecture/MONOLITO_MODULAR.md` publicado e versionado.
- [x] Módulos de domínio organizados conceitualmente e refletidos na documentação.
- [x] Suíte de testes `npm test` executando com 100% de aprovação após cada etapa.
- [x] Deploy para Cloudflare Pages realizado após commit e push conforme `AGENTS.md`.
