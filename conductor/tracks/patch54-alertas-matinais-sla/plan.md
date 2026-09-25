# Plano de Execução: Alertas Matinais SLA & Gestão em Lote (plan.md)

> **Contexto Conductor**  
> **Trilha:** `patch54-alertas-matinais-sla`  
> **Status:** Pronto para Início  
> **Data:** 2026-09-25  

---

## Fases de Execução

### Fase 1: Motor de Varredura e Agregação de SLAs
- [ ] Criar módulo `backend/domains/obras/sla_scanner.js`.
- [ ] Desenvolver query analítica otimizada no Neon PostgreSQL que agrupa por `tenant_id` e `responsavel_user_id`:
  - `atrasadas`: etapas com `status != 'concluido'` e prazo estourado.
  - `vencendo_hoje`: etapas com vencimento na data corrente.
  - `iniciando_hoje`: etapas com início previsto para hoje.
- [ ] Aplicar isolamento multi-tenant e tagged template SQL seguro.

### Fase 2: Formatação de Mensagens e Canais de Saída
- [ ] Criar templates de mensagem WhatsApp (Evolution Go) e e-mail (Resend):
  - Formatação com emojis semânticos (🔴 Atrasadas, 🟡 Vencendo hoje, 🟢 No prazo).
  - Links diretos com token seguro para abrir a etapa no app.
- [ ] Integrar com o Circuit Breaker do Evolution Go implementado na infraestrutura.

### Fase 3: Agendamento, Idempotência e Trigger
- [ ] Configurar cron matinal (`30 10 * * 1-5` UTC = 07:30 BRT segunda a sexta).
- [ ] Criar tabela ou chave Redis de controle de disparo diário (`sla_alert_log:tenant:date:user`) para prevenir disparos duplicados.
- [ ] Adicionar endpoint manual para gestores dispararem reaviso sob demanda (`/api/admin?action=dispatch_daily_sla`).

### Fase 4: Validação, Testes e Homologação
- [ ] Criar script de teste automatizado `scripts/test-patch54-alertas-matinais.js`.
- [ ] Validar cobertura com workers paralelos `npm run test:fast`.
- [ ] Commit semântico, push e deploy conforme `AGENTS.md`.
