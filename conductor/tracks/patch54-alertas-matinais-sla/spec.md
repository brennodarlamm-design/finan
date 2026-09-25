# Trilha Patch 54.3: Alertas Matinais SLA & Gestão em Lote (spec.md)

> **Contexto Conductor**  
> **Trilha:** `patch54-alertas-matinais-sla`  
> **Status:** Pronto para Início  
> **Data de Criação:** 2026-09-25  
> **Responsável:** Antigravity AI  
> **Pilar:** Patch 54 (Sub-trilha 3/3)

---

## 1. Problema e Justificativa

Em projetos de construção civil com dezenas de etapas simultâneas, atrasos de um único dia em serviços críticos (como fundação ou laje) geram efeito dominó em toda a cadeia de subempreiteiros e compras.  
Atualmente:
- O gestor só descobre o estouro de prazo se abrir manualmente o sistema e filtrar o Kanban ou semáforo de SLA.
- Os responsáveis de campo muitas vezes não sabem quais tarefas prioritárias vencem no dia corrente.
- Não existe uma rotina proativa e automatizada que consolide as prioridades antes do início do expediente no canteiro (07:30).

---

## 2. Objetivos da Trilha

1. **Job Matinal Agendado (07:30 Horário de Brasília):**
   - Execução via cron job automatizado no container do Render / Trigger.dev.
   - Varredura de todas as etapas ativas no banco Neon:
     - Etapas vencendo hoje (`D-0`).
     - Etapas já vencidas / atrasadas (`D+N`).
     - Etapas críticas que iniciam hoje.

2. **Disparo Consolidado em Lote (WhatsApp & E-mail):**
   - Agrupamento inteligente por destinatário (evitando spam de múltiplas mensagens).
   - Para o **Responsável Técnico / Engenheiro de Campo**: lista sucinta das tarefas sob sua responsabilidade para o dia.
   - Para o **Diretor / Gestor Geral**: sumário executivo com semáforo de obras (quantas etapas no prazo, em alerta e atrasadas).
   - Envio prioritário via WhatsApp (Evolution Go) com fallback para e-mail transacional (Resend).

3. **Painel de Governança de Alertas:**
   - Visualização do histórico de disparos e status de entrega.
   - Configuração de horário de envio e canais preferenciais por usuário/tenant.
   - Mecanismo anti-duplicação (idempotência com chave `tenant:date:user`).

---

## 3. Critérios de Aceite

- [ ] Job cron configurado em `backend/server.js` ou `trigger/` agendado para 07:30 BRT.
- [ ] Mecanismo idempotente garantindo no máximo 1 alerta consolidado por dia por usuário.
- [ ] Integração com `backend/domains/integrations/evolution_go.js` com Circuit Breaker ativo.
- [ ] Template visual de mensagem WhatsApp com formatação limpa e links diretos para a etapa.
- [ ] Teste automatizado validando a agregação de tarefas, detecção de atrasos e isolamento multi-tenant.
