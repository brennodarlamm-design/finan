# FinGo — Obras em Fluxo

Sistema SaaS de Gestão Financeira e Operacional para a Construção Civil.

[![smithery badge](https://smithery.ai/badge/brennodarlamm-d5fx/fingo-mcp)](https://smithery.ai/servers/brennodarlamm-d5fx/fingo-mcp)

---

## 🤖 Servidor MCP Oficial (Model Context Protocol)

O FinGo disponibiliza um servidor MCP público para integração com agentes de IA, IDEs e assistentes autônomos (Cursor, Claude Desktop, Windsurf, Smithery, Glama):

* **Smithery Server:** https://smithery.ai/servers/brennodarlamm-d5fx/fingo-mcp
* **Endpoint MCP:** `https://fingo.api.br/api/mcp`
* **MCP Server Card:** `https://fingo.api.br/.well-known/mcp/server-card.json`
* **AI Catalog (ARD):** `https://fingo.api.br/.well-known/ai-catalog.json`

### Ferramentas Expostas pelo Servidor MCP:
1. `search_plans`: Consulta planos, recursos, limites de obras e faixas de preço do FinGo.
2. `get_sinapi_info`: Consulta a cobertura oficial da base de engenharia SINAPI (Caixa/IBGE) para os 27 estados (desonerado e não desonerado).
3. `get_financial_summary`: Resumo analítico de fluxo de caixa, contas e centros de custo por obra.

---

## 🚀 Plataforma Web
* **Website Oficial:** [https://fingo.api.br](https://fingo.api.br)
* **Calculadora de BDI Online:** [https://fingo.api.br/calculadora-bdi](https://fingo.api.br/calculadora-bdi)
* **Planos & Preços:** [https://fingo.api.br/planos](https://fingo.api.br/planos)
