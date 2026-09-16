# Trilha: Modernização Master FinObra — Especificação (spec.md)

> **Trilha Conductor**: `modernizacao-master`  
> **Status**: Em Execução  
> **Responsável**: Antigravity AI  
> **Skills Aplicadas**: Todas as 22 skills instaladas

---

## 1. Problema & Motivação

O FinObra amadureceu ao longo de 53 patches, acumulando uma rica gama de funcionalidades (Financeiro, SINAPI, Medições, Workflow, WhatsApp, NF-e SEFAZ). No entanto, para atingir o patamar de software de engenharia civil de classe mundial (*agency-grade*), era imperativo:
1. Eliminar o risco de perda de contexto e desvio arquitetural nas sessões de IA (`conductor`).
2. Atualizar o design para um acabamento visual premium com tokens de design system, micro-interações táteis e hierarquia de KPIs refinada (`tailwind-specialist`, `high-end-visual-design`, `kpi-dashboard-design`).
3. Otimizar a performance de banco, connection pooling e consumo de dados no Neon Postgres (`neon-postgres-egress-optimizer`, `postgresql-optimization`).
4. Fortalecer os contratos RESTful de API, mantendo conformidade incondicional com CSP estrito (`api-design-principles`, `api-security-best-practices`, `security-auditor`).
5. Abrir as portas do sistema para modelos e agentes de IA através do ecossistema de descoberta `llms.txt`.

---

## 2. Escopo & Entregáveis

- [x] **Conductor Core**: Criação de `product.md`, `tech-stack.md`, `workflow.md` e `tracks.md`.
- [ ] **Design Agency-Grade**:
  - Tokens semânticos, escala de espaçamento 4px/8px e utilitários de elevação/micro-interação em `css/style.css`.
  - Redesenho dos cartões de KPI em `minhas_demandas.js` e `central_gestor.js`.
  - Polimento do Kanban e Gantt proporcional em `cronograma_sla.js`.
- [ ] **Neon Postgres & Egress Optimization**:
  - Projeções explícitas e mitigação de cold starts com pooling em `api/_sla.js`.
- [ ] **API Design & Segurança**:
  - Envelope uniforme `{ success, data, timestamp }` e tipagem estrita.
  - Zero violações de CSP (`script-src-attr 'none'`).
- [ ] **Ecossistema llms.txt**:
  - `llms.txt` revisado e criação de `llms-full.txt`.
  - Atualização de `robots.txt` e `sitemap.xml`.
- [ ] **TDD & Qualidade**:
  - Suíte de testes `scripts/test-master-improvement.js` e execução com 100% de sucesso.
