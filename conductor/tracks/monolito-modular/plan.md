# Plano de Execução: Monólito Modular FinGo (plan.md)

> **Contexto Conductor**  
> **Trilha:** `monolito-modular`  
> **Status:** Em Execução  
> **Data:** 2026-09-24  

---

## Fases de Execução

### Fase 1: Diagnóstico e Saneamento da Raiz (Imediata)
- [x] Remover logs temporários e arquivos desnecessários da raiz (`.qa-landing-browser.log`, `.qa-landing-suite.log`, `scratch-startup-tests.log` -> `scratch/logs/`).
- [x] Mover relatórios estáticos (`review-finan-report.md` -> `docs/reports/`).
- [x] Mover scripts avulsos (`CRIAR-PACOTE-LIMPO.bat` -> `bin/`).
- [x] Criar especificação arquitetural `docs/architecture/MONOLITO_MODULAR.md`.
- [x] Atualizar registro de trilhas em `conductor/tracks.md`.

### Fase 2: Estruturação Conceitual & Diretórios Canônicos
- [x] Mapear Bounded Contexts nos domínios do sistema:
  - `fiscal/` (Notas, NF-e, DF-e SEFAZ, Certificados A1)
  - `financeiro/` (Contas, Lançamentos, Cobrança, PIX, Recibos)
  - `obras/` (Obras, Medições, Cronograma SLA, BIM 3D)
  - `suprimentos/` (Pré-compras, Workflow, Produtos, Fornecedores)
  - `contratos/` (Contratos, Assinador Digital, Documentos)
  - `atendimento/` (Suporte, Chat WhatsApp, Notificações)
  - `gestao/` (Dashboard, Central do Gestor, Minhas Demandas)
  - `auth/` (Login, Sessões, 2FA, RBAC)
- [ ] Criar estrutura física em `frontend/modules/` e espelhar com pontes transparentes para `js/`.
- [ ] Mapear páginas de marketing públicas em `marketing/pages/` garantindo cópia no build do Cloudflare.

### Fase 3: Validação, Testes e Deploy
- [ ] Executar `npm test` para garantir conformidade estática total.
- [ ] Commit semântico seguindo a convenção do projeto.
- [ ] Push para `origin/main`.
- [ ] Build e Deploy no Cloudflare Pages.
- [ ] Deploy no Render.
