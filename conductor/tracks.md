# FinObra — Registro de Trilhas & Roadmap (Tracks Registry)

> **Fonte Única da Verdade (Conductor Context)**  
> Versão: 1.0.0  
> Última Atualização: 2026-09-15  
> Metodologia: Conductor Context-Driven Development

---

## 1. Trilha Ativa

| Trilha | Status | Responsável | Início | Previsão | Descrição |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`relatorios-executivos-evidencias`** | 🟡 **Aguardando Início** | Antigravity AI | 2026-09-25 | 2026-09-25 | Patch 54: Fotos e evidências de campo anexadas por etapa do cronograma, PDF A4 executivo e alertas de SLA. |
| **`monolito-modular`** | 🟢 **Concluída com Sucesso** | Antigravity AI | 2026-09-24 | 2026-09-25 | Monólito Modular: 81 módulos frontend canônicos (core e domains), fachadas unificadas em frontend/modules, paridade total com js/, páginas de marketing e testes automatizados. |

- **Especificação**: [`conductor/tracks/monolito-modular/spec.md`](file:///d:/Projects/FINAN%C3%87AS/conductor/tracks/monolito-modular/spec.md)
- **Plano de Execução**: [`conductor/tracks/monolito-modular/plan.md`](file:///d:/Projects/FINAN%C3%87AS/conductor/tracks/monolito-modular/plan.md)

---

## 2. Histórico de Trilhas Concluídas

| Trilha / Patch | Data | Resumo da Entrega | Status |
| :--- | :--- | :--- | :--- |
| **Monólito Modular** | 2026-09-25 | 81 módulos canônicos em frontend/core e frontend/domains, 11 fachadas em frontend/modules/, marketing/pages/ com paridade total, validador de sincronização e suíte test:monolito. | ✅ Concluído |
| **Melhoria Infraestrutura** | 2026-09-25 | 5 fases de infra: WhatsApp Circuit Breaker, Render Graceful Shutdown, Tracing X-Request-Id, Neon Hardening e Cache SWR Edge. | ✅ Concluído |
| **Patch 53** | 2026-09-15 | Integração ativa WhatsApp (Baileys), visões Kanban/Gantt de workflow, automação de avanço em cascata e histórico sanitizado. | ✅ Concluído |
| **Patch 52** | 2026-09-15 | Central do Gestor, Painel Minhas Demandas, semáforo de SLAs, templates configuráveis de workflow por tipo de obra. | ✅ Concluído |
| **Patch 51** | 2026-09-14 | Estrutura base de workflow de etapas, persistência no Neon PostgreSQL, vinculação de cargos e responsáveis. | ✅ Concluído |
| **Patch 50** | 2026-09-14 | Auditoria geral de segurança, revisão de sanitização de inputs e blindagem de rotas críticas da API. | ✅ Concluído |
| **Patch 26** | 2026-09-10 | Implementação do Event Bridge declarativo (`data-fb-*`) e conformidade total com CSP estrito (`script-src-attr 'none'`). | ✅ Concluído |
| **Patches 1-25** | 2026-08/09 | Módulos fundacionais: Financeiro, DRE, Conciliação OFX, SINAPI Oficial, Medições, SEFAZ/A1 e TOTP 2FA. | ✅ Concluído |

---

## 3. Backlog de Trilhas Futuras

1. **`relatorios-executivos-evidencias`** (Antigo Patch 54):
   - Fotos e evidências de campo anexadas por etapa do cronograma.
   - Geração de relatório executivo em PDF A4 de alta fidelidade e exportação em Excel estruturado.
   - Disparo de alertas matinais em lote para responsáveis com pendências no dia.
2. **`ia-copiloto-obras`**:
   - Agente assistente com acesso a `llms.txt` e API para tirar dúvidas de orçamento SINAPI e prever desvios de cronograma.
3. **`app-mobile-offline`**:
   - PWA com suporte a apontamento de campo offline e sincronização automática via background sync.
