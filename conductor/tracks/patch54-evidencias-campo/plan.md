# Plano de Execução: Fotos e Evidências de Campo (plan.md)

> **Contexto Conductor**  
> **Trilha:** `patch54-evidencias-campo`  
> **Status:** Pronto para Início  
> **Data:** 2026-09-25  

---

## Fases de Execução

### Fase 1: Modelagem e Banco de Dados (Neon PostgreSQL)
- [ ] Criar migração versionada `migrations/037_workflow_etapas_evidencias.sql`.
- [ ] Definir tabela `workflow_etapas_evidencias`:
  - `tenant_id`, `obra_id`, `etapa_id`, `id` (UUID), `tipo` (`foto`, `documento`), `url`, `thumbnail_url`, `filename`, `filesize`, `mimetype`, `descricao`, `metadata` (JSONB: gps, camera, tags), `uploaded_by`, `created_at`.
- [ ] Ativar `FORCE ROW LEVEL SECURITY` e criar políticas de isolamento por `app.current_tenant_id`.
- [ ] Criar script de migração e validar no ambiente Neon.

### Fase 2: Backend e Rotas de Integração (API & Cloudflare R2)
- [ ] Adicionar handlers em `api/_workflow.js` e `api/upload.js` para emissão de URLs pré-assinadas e confirmação de anexo de evidências.
- [ ] Validar sanitização de payload e validação estrita de mime types.
- [ ] Registrar evento em `workflow_historico` para auditoria criptográfica de novos anexos.

### Fase 3: Frontend & Componente de Galeria de Canteiro
- [ ] Criar componente visual de galeria em `frontend/domains/obras/cronograma_sla.js` e espelhar em `js/cronograma_sla.js`.
- [ ] Integrar preview de miniaturas na Central do Gestor (`frontend/domains/gestao/central_gestor.js`).
- [ ] Adicionar suporte a captura direta de câmera em dispositivos móveis via `<input accept="image/*" capture="environment">`.
- [ ] Implementar visualizador Lightbox com rotação e zoom.

### Fase 4: Validação, Testes Automatizados e Deploy
- [ ] Criar suíte de testes `scripts/test-patch54-evidencias.js` cobrindo upload, persistência e isolamento multi-tenant.
- [ ] Executar `npm run test:fast` e garantir 100% de aprovação.
- [ ] Commit semântico, push para `origin/main` e deploy conforme `AGENTS.md`.
