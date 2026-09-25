# FinGo — Camada de Módulos (frontend/modules)

> **Padrão de Arquitetura:** Fachada Modular e Pontes Transparentes (Monólito Modular)  
> **Status:** Ativo  
> **Referência:** `docs/architecture/MONOLITO_MODULAR.md`

---

## 1. Visão Geral

O diretório `frontend/modules/` atua como a camada canônica de exportação modular do frontend FinGo, agrupando os submódulos de `frontend/domains/` e `frontend/core/` em fachadas declarativas por Bounded Context:

- `fiscal.js`: `Notas`, `NFe`, `NfeParser`
- `financeiro.js`: `Contas`, `Lancamentos`, `Recibos`, `Parcelamento`, `Cobranca`, `Exportar`, `Ofx`, `ImportarExcel`, `ExportarTemplates`
- `obras.js`: `Clientes`, `ObraDetalhe`, `Medicoes`, `CronogramaSLA`, `FasesDoc`, `BIMViewer`, `BIMClashEngine`, `BIMCSG`, `BIMGeometryImporter`, `BIMPresets`, `BIMStudio`, `BIMIFCExtended`, `CalculadoraBDI`, `Orcamentos`, `Sinapi`
- `suprimentos.js`: `Precompras`, `PrecomprasWorkflow`, `Produtos`, `Fornecedores`
- `contratos.js`: `Contratos`, `Assinador`, `Documentos`, `GDrive`, `ValidarPage`
- `atendimento.js`: `Suporte`, `SuporteDev`, `WhatsApp`, `Notificacoes`
- `gestao.js`: `Dashboard`, `CentralGestor`, `MinhasDemandas`, `AgendaEventos`, `PortalCliente`, `Escritorio`
- `configuracoes.js`: `Configuracoes`, `Master`, `MasterPage`, `DevTenantKeys`, `Academia`, `OCR`
- `core.js`: `Auth`, `DB`, `UI`, `Utils`, `Assets`, `Storage`, `Sentry`
- `index.js`: Ponto de entrada unificado agregando todas as fachadas de domínio.

---

## 2. Pontes Transparentes com `js/`

Para assegurar **zero regressão** e compatibilidade com o carregamento legado de tags `<script>` no navegador (`app.html`, `master.html`, `bim.html`) e com a suíte de testes de regressão estática:
1. Todos os 81 arquivos em `frontend/core/` e `frontend/domains/` mantêm correspondência e paridade exata (100% byte-to-byte) com `js/`.
2. As fachadas em `frontend/modules/` resolvem as entidades em tempo de execução via getters dinâmicos no escopo global/módulo.
