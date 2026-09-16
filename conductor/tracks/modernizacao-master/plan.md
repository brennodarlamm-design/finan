# Trilha: Modernização Master FinObra — Plano de Execução (plan.md)

> **Trilha Conductor**: `modernizacao-master`  
> **Status**: Em Execução  

---

## Fases de Execução

- [x] **Fase 1: Conductor & Context-Driven Architecture**
  - [x] 1.1 Criar `conductor/product.md`
  - [x] 1.2 Criar `conductor/tech-stack.md`
  - [x] 1.3 Criar `conductor/workflow.md`
  - [x] 1.4 Criar `conductor/tracks.md`
  - [x] 1.5 Criar `conductor/tracks/modernizacao-master/spec.md` e `plan.md`

- [x] **Fase 2: Design Agency-Grade & Tokens CSS**
  - [x] 2.1 Adicionar paleta semântica Slate/Zinc/Emerald e utilitários Double-Bezel em `css/style.css`
  - [x] 2.2 Adicionar micro-interações táteis (`active:scale-[0.98]`, cubic-bezier, foco acessível) em `css/style.css`
  - [x] 2.3 Refinar cards de KPI em `js/minhas_demandas.js` e `js/central_gestor.js`
  - [x] 2.4 Refinar Kanban e Gráfico de Gantt em `js/cronograma_sla.js`

- [x] **Fase 3: Neon Postgres, Otimização de Egress & API Design**
  - [x] 3.1 Auditar queries de `api/_sla.js` garantindo pooling e projeção explícita de colunas
  - [x] 3.2 Padronizar envelope RESTful em `api/_sla.js`

- [x] **Fase 4: Ecossistema llms.txt**
  - [x] 4.1 Criar `llms-full.txt` detalhado na raiz
  - [x] 4.2 Atualizar `robots.txt` para liberar crawlers em `/llms.txt` e `/llms-full.txt`
  - [x] 4.3 Atualizar `sitemap.xml` e `data/sitemap.xml`

- [x] **Fase 5: Suíte de Testes Automatizados TDD & Validação**
  - [x] 5.1 Criar `scripts/test-master-improvement.js`
  - [x] 5.2 Adicionar `"test:improvement"` ao `package.json`
  - [x] 5.3 Executar testes completos e validar zero regressões
