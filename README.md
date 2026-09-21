# FinGo — Obras em Fluxo 🏗️⚡

> **Sistema SaaS de Gestão Financeira, Operacional e Engenharia para a Construção Civil.**  
> *Do canteiro ao escritório: custos, compras, medições, orçamentos SINAPI e inteligência de engenharia em um único fluxo.*

---

<div align="center">

[![smithery badge](https://smithery.ai/badge/brennodarlamm-d5fx/fingo-mcp)](https://smithery.ai/servers/brennodarlamm-d5fx/fingo-mcp)
[![Glama MCP](https://img.shields.io/badge/Glama-MCP%20Server%20Published-7F49B8?style=flat&logo=openai&logoColor=white)](https://glama.ai/endpoints/jmtfw2cwfi/mcp)
[![Agent Ready](https://img.shields.io/badge/Agent%20Ready-Verified%20ARD-C6FF00?style=flat&labelColor=0A0A0A)](#-inteligência-artificial--agent-readiness)
[![Edge Worker](https://img.shields.io/badge/Cloudflare-Edge%20Workers%20%26%20Pages-F38020?style=flat&logo=cloudflare&logoColor=white)](#-arquitetura--tecnologia)
[![Database](https://img.shields.io/badge/PostgreSQL-Neon%20Serverless-00E599?style=flat&logo=postgresql&logoColor=white)](#-arquitetura--tecnologia)

**[🌐 Acessar Plataforma Oficial (fingo.api.br)](https://fingo.api.br)** &nbsp;•&nbsp;
**[📐 Calculadora de BDI Online Oficial](https://fingo.api.br/calculadora-bdi)** &nbsp;•&nbsp;
**[💳 Planos & Preços](https://fingo.api.br/planos)** &nbsp;•&nbsp;
**[🏢 Sobre Nós](https://fingo.api.br/sobre-nos)**

</div>

---

## 📌 Visão Geral do Produto

O **FinGo** foi desenvolvido sob medida para a realidade de construtoras, incorporadoras, empreiteiras e escritórios de engenharia. Unifica o controle financeiro rigoroso às rotinas diárias de obra, eliminando planilhas dispersas e retrabalho.

### 🌟 Principais Recursos:

* **📊 Gestão Financeira de Obras:** Centros de custo por obra, plano de contas específico para construção civil, DRE em tempo real, fluxo de caixa projetado x realizado e conciliação bancária OFX.
* **📐 Orçamentos & Base SINAPI Oficial:** Integração completa com os snapshots mensais da **Caixa Econômica Federal e IBGE** para todas as 27 Unidades Federativas do Brasil (opções desoneradas e não desoneradas conforme Lei 14.133/2021 e Decreto Federal 7.983/2013).
* **⚖️ Calculadora Analítica de BDI Oficial TCU:** Cálculo exato de Benefícios e Despesas Indiretas conforme a fórmula oficial do **Acórdão nº 2622/2013 - TCU Plenário**, com limites de referência por tipologia de obra.
* **📋 Medições de Obras com Retenções Técnicas:** Lançamento de medições acumuladas de empreiteiros com apuração automática de retenções contratuais e fiscais (11% INSS patronal, 5% ISS, IRRF e caução).
* **🛒 Compras & Suprimentos com OCR:** Requisições de materiais, ordens de compra com mapa comparativo de cotações, leitura de NF-e via OCR inteligente e importação automática de XMLs via SEFAZ.
* **✍️ Assinatura Eletrônica e Gestão de Documentos:** Armazenamento seguro de projetos, diários de obra, relatórios fotográficos e assinatura eletrônica em conformidade com ICP-Brasil.

---

## 🤖 Servidor MCP Oficial (Model Context Protocol)

O FinGo possui um servidor oficial **Model Context Protocol (MCP)** em conformidade com a especificação **SEP-1649**, publicado nos diretórios globais **Smithery.ai** e **Glama.ai**.

### 🔗 Endpoints de Conexão:
* **Smithery Server Registry:** [`https://smithery.ai/servers/brennodarlamm-d5fx/fingo-mcp`](https://smithery.ai/servers/brennodarlamm-d5fx/fingo-mcp) *(Quality Score 100/100 Verified)*
* **Glama MCP Endpoint:** `https://glama.ai/endpoints/jmtfw2cwfi/mcp`
* **Endpoint Edge Direto:** `https://fingo.api.br/api/mcp`
* **MCP Server Card:** `https://fingo.api.br/.well-known/mcp/server-card.json`

### 💻 Como Conectar no Claude Desktop ou Cursor:

Adicione ao seu arquivo de configuração MCP (`claude_desktop_config.json` ou `.cursor/mcp.json`):

#### Opção A — Conexão via Glama Proxy:
```json
{
  "mcpServers": {
    "fin-go": {
      "url": "https://glama.ai/endpoints/jmtfw2cwfi/mcp",
      "headers": {
        "Authorization": "Bearer <SEU_TOKEN_GLAMA>"
      }
    }
  }
}
```

#### Opção B — Conexão Direta ao Edge Cloudflare (Sem Token):
```json
{
  "mcpServers": {
    "fin-go": {
      "url": "https://fingo.api.br/api/mcp"
    }
  }
}
```

### 🛠️ Ferramentas Disponíveis no Servidor MCP:
1. `search_plans`: Pesquisa planos de assinatura, cotas de obras, usuários simultâneos e capacidades operacionais da plataforma.
2. `get_sinapi_info`: Consulta cobertura e referencial legal das bases analíticas do SINAPI (Caixa/IBGE) para os 27 estados do Brasil (regimes desonerado CPRB e não desonerado).
3. `get_financial_summary`: Retorna resumo sintético de saúde financeira, fluxo de caixa e centros de custo por obra.

---

## 🌐 Inteligência Artificial & Agent Readiness

O FinGo implementa os mais novos protocolos abertos para agentes de IA autônomos e assistentes de engenharia:

| Protocolo | Especificação | Endpoint |
|---|---|---|
| **ARD (Agentic Resource Discovery)** | Manifest Specification v1.0 | `https://fingo.api.br/.well-known/ai-catalog.json` |
| **MCP Server Card** | SEP-1649 | `https://fingo.api.br/.well-known/mcp/server-card.json` |
| **A2A Agent Card** | Agent-to-Agent Protocol v1.0 | `https://fingo.api.br/.well-known/agent-card.json` |
| **RFC 9727 API Catalog** | IETF RFC 9727 Linkset | `https://fingo.api.br/.well-known/api-catalog` |
| **Agent Skills Index** | RFC Agent Skills v0.2.0 | `https://fingo.api.br/.well-known/agent-skills/index.json` |
| **Markdown for Agents** | Content Negotiation (`Accept: text/markdown`) | `GET /` e `GET /planos` com cabeçalho markdown |

---

## 🔒 Arquitetura & Segurança

A plataforma foi construída com foco em resiliência industrial, privacidade e alta disponibilidade:

* **Edge Gateway (Cloudflare Workers & Pages):** Roteamento global de ultra-baixa latência com Content Security Policy (CSP) dinâmico via `nonce`, HSTS estrito e Fail2Ban ativo no edge.
* **Banco de Dados Serverless (PostgreSQL / Neon):** Isolamento multi-tenant estrito com Row Level Security (RLS) obrigatório e backups automáticos diários em Cloudflare R2.
* **Validação Pré-Deploy:** Regra inegociável de 100% de testes automatizados e aprovação estática antes de qualquer publicação em produção.
* **Conformidade LGPD:** Criptografia em trânsito (TLS 1.3) e em repouso (AES-GCM), com auditoria detalhada de acessos e operações sensíveis.

---

## 📂 Estrutura do Repositório

```text
├── .agents/               # Skills e regras de inteligência de engenharia e segurança
├── api/                   # Handlers de backend serverless e adaptadores edge
├── cloudflare/            # Configurações e cabeçalhos de borda Cloudflare
├── css/                   # Tokens de design e folhas de estilo Brutalist Tech
├── data/                  # Metadados e catálogos estáticos do sistema
├── docs/                  # Documentação técnica, arquitetura e segurança
│   ├── security/          # Hardening, RLS, contexto de tenants e auditorias
│   └── portais-e-diretorios.md # Kit de distribuição e submissão em diretórios
├── js/                    # Módulos frontend do cliente, WebMCP e regras de negócio
├── marketing/             # Componentes React 19 da vitrine institucional FinGo
├── scripts/               # Suíte de testes automatizados e rotinas de deploy
├── cloudflare-worker.js   # Edge gateway, firewall, descoberta ARD e MCP Server
├── landing.html           # Landing page institucional otimizada para SEO
├── calculadora-bdi.html   # Calculadora de BDI pública em conformidade com TCU
├── planos.html            # Comparativo de planos comerciais e contratação
└── sw.js                  # Service Worker oficial com cache offline PWA
```

---

## 📄 Licença & Propriedade

© 2026 **FinGo Tecnologia**. Todos os direitos reservados.  
Software proprietário para construtoras e incorporadoras. Para parcerias comerciais e contato técnico: `contato@fingo.api.br` ou via [WhatsApp Comercial](https://wa.me/5595991363678).
