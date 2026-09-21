---
name: sinapi-budgeting
description: Consulta a composições de custo oficiais SINAPI Caixa/IBGE e orçamentação de engenharia para licitações e obras privadas.
---

# FinGo Skill: Orçamentação Paramétrica & SINAPI

Permite que agentes de IA acessem o catálogo oficial da base SINAPI da Caixa Econômica Federal e IBGE para 27 Unidades Federativas nos regimes desonerado e não desonerado, aplicando BDI diferenciado para materiais e serviços conforme Lei 14.133/2021 e Decreto 7.983/2013.

## Capacidades

- Busca de insumos e composições analíticas por código ou descrição semântica.
- Cálculo de BDI (Bonificação e Despesas Indiretas) com limites do TCU.
- Geração e exportação de planilhas orçamentárias analíticas e sintéticas.
- Curva ABC de insumos e serviços para controle de compras.

## Endpoints Associados

- `GET /api/db?entity=sinapi`
- `GET /api/dashboard`
