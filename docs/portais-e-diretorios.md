# Kit de Cadastro em Portais, Diretórios de SaaS & Registros de IA — FinGo

Este documento contém todas as informações estruturadas (títulos, descrições curtas e longas, categorias, tags, links canônicos e endpoints técnicos) necessárias para cadastrar o **FinGo** nos principais portais do Brasil e do mundo.

---

## 🇧🇷 1. Portais de Software B2B no Brasil

### 1.1. B2B Stack (O maior portal B2B de software do Brasil)
* **URL de Cadastro de Fornecedor:** https://www.b2bstack.com.br/anuncie (ou "Cadastrar Produto")
* **Nome do Produto:** FinGo
* **Slogan / One-liner:** Sistema de Gestão Financeira e Operacional de Obras para Construtoras
* **Website:** `https://fingo.api.br`
* **Categorias Principais:**
  - Software de Gestão de Obras (Construção Civil)
  - Gestão Financeira para Construtoras
  - Orçamento de Obras & SINAPI
  - Emissor de NF-e & Gestão de Retenções Tributárias
* **Descrição Curta (até 250 caracteres):**
  > O FinGo conecta canteiro e escritório. Do controle de contas a pagar e fluxo de caixa ao orçamento com tabelas oficiais SINAPI (Caixa/IBGE), medições com retenções de impostos e emissão de notas fiscais.
* **Descrição Completa:**
  > O FinGo é uma plataforma em nuvem desenvolvida sob medida para construtoras, empreiteiras e incorporadoras. Reúne em uma interface rápida e intuitiva:
  > - **Gestão Financeira & Caixa:** Contas a pagar e receber, conciliação bancária, centros de custo por obra e DRE em tempo real.
  > - **Orçamentos com SINAPI Oficial:** Integração direta com as bases mensais da Caixa Econômica Federal e IBGE para os 27 estados (desonerado e não desonerado), com cálculo de BDI analítico (Decreto 7.983/2013).
  > - **Medições de Obra com Retenções:** Cálculo automatizado de INSS (3,5% ou 11%), ISS, IRRF e CSLL/PIS/COFINS por tipo de contrato.
  > - **Documentos e Assinatura Eletrônica:** Emissão de NF-e, upload com OCR de notas fiscais e assinatura eletrônica com validade jurídica ICP-Brasil.
  > - **Mobilidade no Canteiro:** Acesso 100% responsivo para celular e tablet sem necessidade de instalar aplicativos pesados.
* **Público-Alvo:** Construtoras de pequeno e médio porte, empreiteiras, engenheiros civis autônomos, arquitetos e gestores de obras.
* **Modelo de Preço:** Assinatura Mensal / Anual a partir de R$ 119,90/mês (Teste grátis por 15 dias sem fidelidade).

---

### 1.2. Capterra Brasil & Gartner Digital Markets
* **URL de Cadastro:** https://www.capterra.com.br/fornecedores
* **Nome:** FinGo
* **Categoria:** Software para Construção Civil / Gestão Financeira
* **País:** Brasil
* **Idiomas:** Português (Brasil)
* **Diferenciais:** Preço transparente e acessível, implantação zero (pronto para usar), base SINAPI inclusa, suporte humanizado via WhatsApp.

---

### 1.3. Google Meu Negócio / Google Perfil de Empresa
* **Nome:** FinGo Tecnologia — Software de Gestão de Obras
* **Categoria Principal:** Empresa de Software
* **Categorias Secundárias:** Serviços de TI, Engenharia Civil
* **Website:** `https://fingo.api.br`
* **Área de Atendimento:** Brasil (Atendimento Nacional Online)

---

## 🤖 2. Diretórios Globais de IA & Model Context Protocol (MCP)

O FinGo possui conformidade com o **padrão SEP-1649 (MCP Server Card)** e protocolo **Agentic Resource Discovery (ARD)**.

### 2.1. Smithery.ai (Diretório de Servidores MCP)
* **URL de Submissão:** https://smithery.ai/new
* **Nome do Servidor:** `fingo-mcp-server`
* **URL do MCP Server:** `https://fingo.api.br/api/mcp`
* **URL do Server Card:** `https://fingo.api.br/.well-known/mcp/server-card.json`
* **Descrição:** Model Context Protocol (MCP) server for FinGo: construction budget lookup, official Caixa/IBGE SINAPI database for all 27 Brazilian states, and construction financial management.
* **Tags:** `construction`, `sinapi`, `finance`, `budgeting`, `civil-engineering`, `brazil`

---

### 2.2. Glama.ai (MCP Registry) — **PUBLICADO ✅**
* **Status:** Publicado com sucesso no registro oficial do Glama.
* **Glama Proxy Endpoint:** `https://glama.ai/endpoints/jmtfw2cwfi/mcp`
* **Endpoint Direto:** `https://fingo.api.br/api/mcp`
* **Configuração para Clientes (Claude Desktop / Cursor):**
```json
{
  "mcpServers": {
    "fin-go": {
      "url": "https://glama.ai/endpoints/jmtfw2cwfi/mcp",
      "headers": {
        "Authorization": "Bearer <ACCESS_TOKEN>"
      }
    }
  }
}
```
* **Capabilities:** Tools (`search_plans`, `get_sinapi_info`, `get_financial_summary`) com JSON-RPC 2.0 e output tipado.

---

### 2.3. GitHub Agentfinder Catalog (`github/agentfinder-catalog`) — **PR ABERTO #52 ✅**
* **Repositório:** https://github.com/github/agentfinder-catalog
* **Pull Request Oficial:** https://github.com/github/agentfinder-catalog/pull/52
* **Fork:** `https://github.com/brennodarlamm-design/agentfinder-catalog`
* **Branch:** `add-fingo-mcp-server`
* **Arquivo Submetido:** `catalog/brennodarlamm-design/fingo-mcp-server.json`
* **Conteúdo do Augment:**
```json
{
  "identifier": "urn:ai:github.com:brennodarlamm-design:finan:fingo-mcp-server",
  "displayName": "FinGo MCP Server",
  "mediaType": "application/mcp-server-card+json",
  "url": "https://fingo.api.br/.well-known/mcp/server-card.json",
  "description": "FinGo Model Context Protocol (MCP) server providing construction budget, SINAPI lookup, and financial management tools.",
  "tags": [
    "mcp-server",
    "construction",
    "budgeting",
    "finance",
    "sinapi",
    "civil-engineering"
  ],
  "metadata": {
    "sourceSet": "finan",
    "repoPath": ".well-known/mcp/server-card.json"
  }
}
```

---

### 2.4. PulseMCP & mcp.so
* **PulseMCP:** https://pulsemcp.com/submit
* **mcp.so:** https://mcp.so/submit
* **Dados:** Nome `FinGo`, URL `https://fingo.api.br/api/mcp`, Categoria `Productivity & Enterprise Tools`.

---

## 🚀 3. Roteiro Prático de Execução

1. **Passo 1 (5 minutos):** Cadastrar no **B2B Stack** (`https://www.b2bstack.com.br/anuncie`) copiando o texto do item 1.1 acima. É o portal mais acessado por diretores de construtoras no Brasil.
2. **Passo 2 (3 minutos):** Submeter o servidor MCP no **Smithery.ai** (`https://smithery.ai/new`) e no **Glama.ai** usando `https://fingo.api.br/api/mcp`.
3. **Passo 3 (5 minutos):** Criar a ficha no **Google Meu Negócio** para garantir que a busca por "FinGo Software" ou "FinGo Construtora" mostre o card oficial no Google.
