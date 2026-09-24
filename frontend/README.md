# FinGo — Camada de Frontend (Monólito Modular)

> **Fronteira Arquitetural:** Interface de Usuário & SaaS SPA  
> **Shell Principal:** `app.html`  
> **Padrão de Execução:** Vanilla ES6+ Modules com Design Tokens e Barramento de Eventos Declarativo (`data-fb-*`).

---

## 1. Organização dos Módulos de Domínio

O frontend é particionado em **Bounded Contexts** para evitar o crescimento desordenado de arquivos flat.

```
frontend/
├── core/                       # Kernel da Aplicação (Infraestrutura Frontend)
│   ├── auth.js                 # Autenticação, sessão, JWT e verificação de perfil
│   ├── data.js                 # IndexedDB, sincronização offline e persistência local
│   ├── data_demo.js            # Mock dataset isolado para modo demonstração
│   ├── ui.js                   # Renderizadores de modais, toasts, badges e skeletons
│   ├── utils.js                # Formatadores de moeda, data, máscara e escape HTML (esc)
│   ├── assets.js               # Carregador de ícones e SVGs
│   ├── patch26-events.js       # Barramento central de eventos compatível com CSP estrito
│   └── patch26-actions.js      # Actions despachadas pelo barramento
│
└── domains/                    # Módulos Funcionais de Negócio
    ├── fiscal/                 # Notas Fiscais, NF-e, DF-e SEFAZ e Certificados A1
    │   ├── notas.js            # Tabela de NFs, cadastro manual, filtros e soma
    │   ├── nfe.js              # Gestão do Certificado A1 e disparo de sincronização DF-e
    │   └── nfe_parser.js       # Parser de XML NF-e/CT-e no navegador
    │
    ├── financeiro/             # Gestão Financeira e Caixa
    │   ├── contas.js           # Contas bancárias, caixas e saldos
    │   ├── lancamentos.js      # Despesas, receitas e fluxo de caixa
    │   ├── recibos.js          # Emissão de recibos digitais
    │   ├── parcelamento.js     # Gestão e projeção de parcelas
    │   ├── cobranca.js         # Geração de cobranças e conciliação
    │   └── exportar.js         # Exportação para Excel e relatórios
    │
    ├── obras/                  # Engenharia e Gestão de Campo
    │   ├── clientes.js         # Cadastro de Obras e Clientes
    │   ├── obra_detalhe.js     # Visão consolidada da obra
    │   ├── medicoes.js         # Medições com retenções de impostos (INSS/ISS)
    │   ├── cronograma_sla.js   # Etapas de obra com semáforo de SLAs
    │   └── bim_*.js            # Visualizador 3D BIM, CSG e Clash Detection
    │
    ├── suprimentos/            # Suprimentos, Materiais e Fornecedores
    │   ├── precompras.js       # Requisições de compra do canteiro
    │   ├── precompras_workflow.js # Workflow de aprovação de cotações
    │   ├── produtos.js         # Catálogo de insumos e composições
    │   └── fornecedores.js     # Histórico de fornecedores e cotações
    │
    ├── contratos/              # Contratos e Assinaturas
    │   ├── contratos.js        # Gestão de contratos de prestação de serviços
    │   ├── assinador.js        # Interface de assinatura eletrônica
    │   └── documentos.js       # Repositório de anexos com badge de clipes
    │
    ├── atendimento/            # Comunicação com o Cliente
    │   ├── suporte.js          # Central de ajuda e chamados
    │   ├── suporte_dev.js      # Painel de atendimento do operador
    │   ├── whatsapp.js         # Chat WhatsApp integrado
    │   └── notificacoes.js     # Central de notificações
    │
    ├── gestao/                 # BI, Indicadores e Central do Diretor
    │   ├── dashboard.js        # Indicadores executivos (KPIs)
    │   ├── central_gestor.js   # Painel consolidado do gestor
    │   ├── minhas_demandas.js  # Kanban individual de tarefas
    │   └── agenda_eventos.js   # Calendário de vistorias e eventos
    │
    └── configuracoes/          # Preferências do Sistema
        ├── configuracoes.js    # Dados da construtora, certificado e SLAs
        ├── master.js           # Painel super-admin do SaaS
        └── dev-tenant-keys.js  # Chaves de acesso e credenciais de tenant
```

---

## 2. Invariantes de Desenvolvimento no Frontend

1. **CSP Estrito (Content Security Policy):**
   - **NUNCA** adicione manipuladores de eventos inline (`onclick`, `onchange`, `onsubmit`).
   - Use os atributos declarativos:
     - `data-fb-click="Modulo.metodo"`
     - `data-fb-change="Modulo.onSelect"`
     - `data-fb-input="Modulo.onInput"`
2. **Sanitização de HTML:**
   - Ao interpolar valores dinâmicos em strings literais HTML, utilize sempre o helper `esc(valor)` ou `Utils.esc(valor)`.
3. **Compatibilidade e Transição:**
   - A pasta `js/` na raiz atua como ponte de compatibilidade para o carregamento no navegador (`app.html`) e para a suíte de testes de regressão estática.
