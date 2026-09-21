---
name: financial-management
description: Gestão financeira, contas a pagar e receber, fluxo de caixa e centros de custo para obras de construção civil.
---

# FinGo Skill: Gestão Financeira de Obras

Permite que agentes de IA consultem saldos consolidados, lancem despesas e receitas, processem contas a pagar/receber e analisem o fluxo de caixa projetado versus realizado por centro de custo de obras.

## Capacidades

- Consulta de transações financeiras filtradas por obra, fornecedor e categoria.
- Lançamento de despesas com classificação contábil da construção civil.
- Conciliação bancária de pagamentos via PIX, boleto e cartão de crédito.
- Análise de margem operacional e desvios de orçamento da obra.

## Endpoints Associados

- `GET /api/db?entity=transacoes`
- `POST /api/db` (com `entity: "transacoes"`)
- `GET /api/dashboard`
