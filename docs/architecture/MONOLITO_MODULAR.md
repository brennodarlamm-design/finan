# FinGo — Arquitetura de Monólito Modular

> **Documento Oficial de Arquitetura e Governança**  
> **Versão:** 1.0.0 — Setembro/2026  
> **Status:** Ativo  
> **Referência Conductor:** `conductor/tracks/monolito-modular/`

---

## 1. Visão Geral e Princípios Fundamentais

O **FinGo** adota o padrão de **Monólito Modular** (*Modular Monolith*). Essa decisão arquitetural une a **simplicidade operacional** de uma base de código unificada (um único repositório, deploy previsível, transações consistentes e ausência de latência de rede entre serviços) com o **rigor e manutenibilidade** de módulos independentes com fronteiras de domínio bem demarcadas (*Bounded Contexts*).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ARQUITETURA FINGO                                │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │      MARKETING       │  │       FRONTEND       │  │     BACKEND      │  │
│  │ (Landing, Blog, SEO, │  │ (SPA Autenticada,    │  │ (Node/Express,   │  │
│  │  Páginas Públicas)   │  │  Design Tokens,      │  │  APIs REST,      │  │
│  │                      │  │  Módulos de Domínio) │  │  Regras Domínio) │  │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬─────────┘  │
│             │                         │                       │             │
│             ▼                         ▼                       ▼             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      SHARED / INFRA / GATEWAY                         │  │
│  │   • Cloudflare Edge Worker (Roteamento, CDN, Cache, WAF, R2 Storage)  │  │
│  │   • Contratos Compartilhados (OpenAPI, Tipos, Schemas de Validação)   │  │
│  │   • Banco Neon PostgreSQL (Multi-tenant, Migrations SQL, RLS)         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Princípios Inegociáveis:
1. **Alta Coesão Interna, Baixo Acoplamento Externo:** Cada domínio de negócio gerencia seu próprio ciclo de vida e estado, expondo apenas contratos públicos.
2. **Separação Assertiva de Responsabilidades:** Código de interface de usuário (Frontend), APIs e lógica de servidor (Backend) e páginas de aquisição/conversão (Marketing) possuem propósitos e ciclos de entrega distintos.
3. **Padrão de Ponte e Resiliência (Zero-Downtime Migration):** Qualquer reorganização de diretórios mantém pontes (*facades / re-exports*) para assegurar compatibilidade absoluta com os testes automatizados existentes e pipelines de CI/CD.
4. **Deploy Determinístico (AGENTS.md):** Teste -> Commit -> Push -> Deploy (Cloudflare Pages para frontend/marketing; Render para o backend contínuo).

---

## 2. Divisões Assertivas de Alto Nível

| Camada | Diretório Principal | Propósito | Tecnologias Chave | Destino de Produção |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `frontend/` (e pontes em `js/`) | Aplicação SPA principal para clientes autenticados. Gestão financeira, canteiro, fiscal e contratos. | Vanilla ES6+ Modules, Design System Tokens, Event Bridge (`data-fb-*`), CSP Estrito. | Cloudflare Pages (`dist/`) |
| **Backend** | `backend/` (e rotas em `api/`) | API REST unificada, robôs 24/7 (SINAPI e WhatsApp Baileys), autenticação, mutações de dados e regras de negócio. | Node.js, Express, Neon PostgreSQL Pooler, JWT/TOTP, Baileys. | Render (`finan-backend`) |
| **Marketing** | `marketing/` | Portal público de aquisição: Landing Page, Planos, Manuais, Blog, Ferramentas públicas (Calculadora BDI, Validador). | React, Vite, Tailwind CSS (na Landing), HTML Semântico SEO. | Cloudflare Pages (`dist/`) |
| **Edge Gateway** | `edge/` (e raiz `cloudflare-worker.js`) | Gateway de borda da Cloudflare: CDN, proxy de APIs para Render, autenticação edge, storage de anexos R2 e WebSocket/Realtime. | Cloudflare Workers, R2 Buckets, Wrangler. | Cloudflare Workers (`finan`) |
| **Shared** | `shared/` (e `migrations/`) | Contratos de API, migrações de banco Neon, scripts DDL e definições comuns. | SQL, OpenAPI 3.0, JSON Schemas. | Neon Database |
| **Infra & DevOps** | `infra/` e `scripts/` | Suíte de testes estáticos e integração, rotinas de backup, runners de deploy e configurações de plataforma. | Node.js, Wrangler, Dockerfile, render.yaml. | CI/CD / Scripts Locais |

---

## 3. Mapeamento de Domínios de Negócio (Bounded Contexts)

Tanto o **Frontend** quanto o **Backend** compartilham a mesma taxonomia de domínios:

```
domains/
├── fiscal/             # Notas Fiscais (NFe), DF-e SEFAZ, Certificados Digitais A1
├── financeiro/         # Contas a Pagar/Receber, Lançamentos, Conciliação OFX, PIX, DRE
├── obras/              # Cadastros de Obras/Clientes, Medições, Cronograma SLA, BIM 3D
├── suprimentos/        # Requisições de Pré-compras, Cotações, Produtos, Fornecedores
├── contratos/          # Gestão Contratual, Assinador Eletrônico ICP-Brasil, Documentos
├── atendimento/        # Chamados de Suporte, Chat WhatsApp, FinBot, Notificações Push
├── gestao/             # Dashboard Executivo, Central do Gestor, Painel Minhas Demandas
└── auth/               # Autenticação, Sessões, RBAC, 2FA/TOTP, Chaves de API
```

### Detalhamento por Domínio:

#### 1. Domínio Fiscal (`fiscal`)
- **Frontend:**
  - `notas.js`: Listagem, filtros e emissão/cadastro manual de notas fiscais.
  - `nfe.js`: Gestão de certificados digitais A1, sincronização SEFAZ DF-e e monitor.
  - `nfe_parser.js`: Extração e validação cliente de XMLs de NF-e e CT-e.
- **Backend:**
  - `_sefaz-dfe.js`: Comunicação SOAP com os webservices da SEFAZ nacional e distribuição de DF-e.
  - `_certificado.js`: Decifração segura, validação PKCS#12 e extração de chaves criptográficas X.509 em memória.
  - `nfe.js`: Endpoints REST para upload de XML, validação de chaves e manifesto de destinatário.

#### 2. Domínio Financeiro (`financeiro`)
- **Frontend:**
  - `contas.js`: Gestão de contas bancárias, caixas de obra e saldos.
  - `lancamentos.js`: Lançamentos de despesas e receitas com centros de custo.
  - `recibos.js`: Emissão de recibos digitais com assinatura.
  - `parcelamento.js`: Projeção de parcelas e contratos parcelados.
  - `cobranca.js`: Emissão de cobranças e conciliação.
  - `exportar.js`: Exportação contábil para Excel, CSV e PDF.
- **Backend:**
  - `_webhook_pix.js` & `_webhook_pix_core.js`: Processamento atômico e idempotente de webhooks bancários PIX.
  - `_plans.js` & `plano.js`: Regras de faturamento, planos SaaS, limites de uso e assinaturas.

#### 3. Domínio de Obras & Engenharia (`obras`)
- **Frontend:**
  - `clientes.js`: Cadastro de obras, clientes e responsáveis técnicos (CREA/CAU).
  - `obra_detalhe.js`: Visão 360º da obra com gráficos de avanço físico-financeiro.
  - `medicoes.js`: Boletins de medição com cálculo automatizado de retenções (INSS, ISS, IRRF, CSLL).
  - `cronograma_sla.js`: Cronograma de etapas com semáforo de SLAs por tipo de empreendimento.
  - `bim_*.js`: Suíte completa de visualização 3D BIM (CSG, IFC, importador e clash detection).
- **Backend:**
  - `_workflow.js`, `_workflow-stage-update.js`: Máquina de estados de avanço de etapas de obra.
  - `_sla.js`: Regras de cálculo de prazos e alarmes de estouro de prazo.

#### 4. Domínio de Suprimentos & Compras (`suprimentos`)
- **Frontend:**
  - `precompras.js` & `precompras_workflow.js`: Solicitações de compra do canteiro para o escritório com aprovação por alçadas.
  - `produtos.js`: Catálogo unificado de insumos, materiais e serviços.
  - `fornecedores.js`: Cadastro de fornecedores com histórico de preços praticados.
- **Backend:**
  - `sinapi_robot.js`: Robô crawler de atualização periódica dos índices mensais SINAPI (Caixa/IBGE).

#### 5. Domínio de Contratos & Documentos (`contratos`)
- **Frontend:**
  - `contratos.js`: Minutas contratuais de prestação de serviços e fornecimento.
  - `assinador.js`: Interface de assinatura manuscrita e validação de certificados.
  - `documentos.js`: Repositório de arquivos anexos por entidade com badge de clipes.
- **Backend:**
  - `assinaturas.js`: Registro de auditoria criptográfica de assinaturas (SHA-256, carimbo de tempo, IP).
  - `upload.js`: Upload seguro com streaming direto para Cloudflare R2.

#### 6. Domínio de Atendimento & Notificações (`atendimento`)
- **Frontend:**
  - `suporte.js`: Central de ajuda com abertura de tickets e chat integrado.
  - `whatsapp.js`: Interface de atendimento via WhatsApp integrado.
  - `notificacoes.js`: Central de notificações em tempo real.
- **Backend:**
  - `server.js` (Baileys Engine): Servidor WhatsApp multi-tenant com reconexão automática e QR Code.
  - `_edge-alerts.js`: Despacho de alertas de sistema e monitoramento de falhas.

#### 7. Domínio de Gestão & Inteligência (`gestao`)
- **Frontend:**
  - `dashboard.js`: KPIs executivos em tempo real (Total faturado, pendências, saldo consolidado).
  - `central_gestor.js`: Painel consolidado para diretores e engenheiros-chefe.
  - `minhas_demandas.js`: Painel kanban pessoal de tarefas pendentes por usuário.
  - `agenda_eventos.js`: Calendário de vistorias, entregas e marcos contratuais.
- **Backend:**
  - `dashboard.js`: Agregações SQL de alto desempenho com projeções otimizadas para baixo consumo de egress no Neon.

#### 8. Domínio de Identidade & Acesso (`auth`)
- **Frontend:**
  - `auth.js`: Gerenciamento de login, token JWT, renovação de sessão e estado de autenticação.
- **Backend:**
  - `_auth.js`: Verificação de credenciais com bcrypt/argon2, criação de tokens e validação de sessão.
  - `_totp.js`: Autenticação multifator (2FA) baseada em RFC 6238.
  - `_permissions.js` & `_cargos.js`: Matriz RBAC multi-tenant estrita.

---

## 4. Guia Prático para Novas Manutenções

Ao criar uma nova funcionalidade no sistema, siga o roteiro abaixo:

### Passo 1: Identificar o Domínio de Negócio
- A funcionalidade pertence a qual domínio? (ex: `fiscal`, `financeiro`, `obras`, etc.).
- Se envolver persistência no banco, crie a migration versionada em `migrations/XXX_nome.sql` e execute o script runner dedicado.

### Passo 2: Implementar no Frontend
- Adicione as rotinas de visualização e lógica no módulo de domínio correspondente.
- Garanta que todos os botões e inputs usem o barramento de eventos:
  - `data-fb-click="Modulo.metodo"`
  - `data-fb-change="Modulo.onSelect"`
  - Proibido o uso de `onclick="..."` inline (violação de CSP).
- Utilize sempre `Utils.esc(...)` ou `esc(...)` ao interpolar valores em templates HTML.

### Passo 3: Implementar no Backend
- Mantenha funções puras e isolamento multi-tenant:
  - Todas as queries SQL **DEVEM** incluir o predicado `tenant_id = $1` ou passar pelo isolamento de sessão do Neon.
  - Sanitização de entrada obrigatória contra injeção SQL e XSS.
- Exponha rotas em formato RESTful com códigos HTTP semânticos (200, 201, 400, 401, 403, 404, 500).

### Passo 4: Validação & Regra Inegociável de Deploy
1. **Executar testes:** `npm test` (todos os testes devem passar com código 0).
2. **Commit semântico:** `git commit -m "tipo(escopo): descrição detalhada"`
3. **Push:** `git push origin main`
4. **Deploy:**
   - Frontend/Marketing: `npm run build:cloudflare && npm run deploy:cloudflare`
   - Backend Render: `npm run render:deploy` (ou script automático).
5. ❌ **NUNCA DEPLOY NA VERCEL.**
