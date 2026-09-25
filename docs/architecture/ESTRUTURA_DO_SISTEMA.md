# FinGo — Estrutura e Arquitetura Completa do Sistema Ponta a Ponta

> **Documento Oficial de Estrutura de Sistema e Arquitetura Técnica**  
> **Versão:** 2.40.6 — Setembro/2026  
> **Status:** Ativo  
> **Classificação:** Documentação Técnica Estrutural

---

## 1. Visão Geral da Plataforma

O **FinGo** (anteriormente FinObra) é uma plataforma SaaS modular de gestão financeira, engenharia, canteiro de obras, compras e conformidade fiscal (NF-e/DF-e) voltada para construtoras, incorporadoras e prestadores de serviços da construção civil.

A plataforma foi desenhada sob a filosofia de **Monólito Modular** com **Processamento de Borda (*Edge-First*)** e **Alta Disponibilidade Offline-First**, eliminando custos e complexidades desnecessárias de microsserviços enquanto preserva fronteiras rígidas de código e domínio (*Bounded Contexts*).

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 TOPOLOGIA COMPLETA DO FINGO                                 │
│                                                                                             │
│  [ CLIENTES / CANTEIRO ]                                                                    │
│     ├── Desktop / Notebook (Navegador Chrome/Edge/Firefox)                                  │
│     ├── Mobile / Tablet no Canteiro (PWA / TWA Android com IndexedDB offline)               │
│     └── Clientes Externos (Portal de Medição e Assinatura Eletrônica)                       │
│                                      │                                                      │
│                                      ▼ HTTPS / WSS                                          │
│  [ BORDA CLOUDFLARE (Edge Worker & Pages) ]                                                 │
│     ├── Roteamento de rotas canônicas e SPA fallback                                        │
│     ├── CDN Global de Assets Estáticos Sanitizados (pasta dist/)                            │
│     ├── Fail2Ban Distribuído no Cloudflare KV e WAF de Aplicação                            │
│     ├── CSP Estrita com Nonce dinâmico e proteção de cabeçalhos                             │
│     └── Storage de Anexos no Cloudflare R2 (fingo-attachments)                              │
│                                      │                                                      │
│                ┌─────────────────────┴──────────────────────┐                               │
│                ▼                                            ▼                               │
│  [ MICRO-APIS SERVERLESS (api/*) ]          [ SERVIDOR 24/7 RENDER (backend/server.js) ]    │
│     • Multiplexação em 12 rotas públicas       • Conexão contínua WhatsApp Baileys          │
│     • Autenticação JWT / Cookie / TOTP         • Monitor e Ingestão SINAPI 27 UFs           │
│     • CRUD financeiro, obras, notas            • Webhook Receiver e Cron Jobs               │
│     • Conexão direta pooling Neon              • Docker container sob node:18-alpine        │
│                │                                            │                               │
│                └─────────────────────┬──────────────────────┘                               │
│                                      │ SSL Pooling (TLS 1.3)                                │
│                                      ▼                                                      │
│  [ BANCO DE DADOS NEON POSTGRESQL (Serverless Postgres) ]                                   │
│     ├── Multi-Tenancy estrito com FORCE ROW LEVEL SECURITY (RLS)                            │
│     ├── Role finobra_app (NOBYPASSRLS) para runtime de usuários                             │
│     ├── Role neondb_owner para migrações DDL e bootstrap isolado                            │
│     └── Versionamento atômico em migrations/ (001 a 032+)                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Camadas da Arquitetura

### 2.1 Camada 1: Frontend SPA (Vanilla Modular ES6+)
- **Localização:** `frontend/` (com pontes de compatibilidade em `js/`).
- **Padrão:** Single Page Application (SPA) em JavaScript Moderno sem frameworks pesados no core operacional, proporcionando tempo de carregamento imediato (*Time to Interactive < 1s*).
- **Shells da Aplicação:**
  - `app.html`: Shell principal da aplicação autenticada (Finanças, Obras, Canteiro, Suprimentos).
  - `master.html`: Painel super-admin para governança da plataforma SaaS.
  - `bim.html`: Visualizador 3D BIM, CSG e Clash Detection baseado em Three.js.
  - `landing.html`, `calculadora-bdi.html`, `validar.html`: Portais de aquisição e utilitários públicos.
- **Barramento de Eventos:** `frontend/core/patch26-events.js` gerencia eventos por delegação declarativa (`data-fb-click`, `data-fb-change`, `data-fb-input`), cumprindo a política estrita de CSP (`script-src-attr 'none'`).
- **Resiliência Offline:** `frontend/core/data.js` implementa sincronização bidirecional entre o IndexedDB do navegador e a nuvem via fila local, Circuit Breaker com Jitter e detecção de conflitos de versão.

### 2.2 Camada 2: Borda e Perímetro (Cloudflare Edge Worker)
- **Localização:** `cloudflare-worker.js`, `wrangler.jsonc`, `cloudflare/`.
- **Funções:**
  - **Reverse Proxy Inteligente:** Encaminha requisições de API para os handlers serverless ou para o container Render.
  - **Injeção de Segurança:** Aplica headers HSTS, `X-Frame-Options`, `X-Content-Type-Options: nosniff` e política CSP rigorosa com nonce dinâmico.
  - **Fail2Ban de Borda:** Mitiga tentativas de força bruta através de pontuação de abuso gravada no Cloudflare KV.
  - **Object Storage R2:** Fornece upload e download privado de anexos de obras, contratos e medições através do bucket `fingo-attachments`.
  - **Descoberta de Agentes:** Expõe metadados RFC 9727, MCP Server Cards e AI Catalogs em `/.well-known/*`.

### 2.3 Camada 3: APIs Serverless (Vercel / Cloudflare Compatíveis)
- **Localização:** `api/`.
- **Invariante de 12 Funções:** Mantém estritamente no máximo 12 rotas públicas de nível superior para atender limites de plataformas serverless, multiplexando submódulos prefixados com `_`:
  1. `admin.js`: Governança da plataforma e suporte ao tenant.
  2. `assinaturas.js`: Registro e validação de assinaturas eletrônicas de contratos.
  3. `audit.js`: Trilha de auditoria criptográfica e eventos de segurança.
  4. `auth.js`: Login, registro, MFA, recuperação de senha e renovação de token.
  5. `dashboard.js`: Agregações analíticas e KPIs financeiros em tempo real.
  6. `db.js`: API central de sincronização de dados (delta sync, snapshots, mutações atômicas).
  7. `nfe.js`: Gestão de certificados A1, consulta SEFAZ e manifesto de notas.
  8. `plano.js`: Gestão de assinaturas SaaS, limites de uso e checkout.
  9. `reconhecer-documento.js`: Motor OCR para extração inteligente de notas e recibos.
  10. `upload.js`: Gerenciamento de arquivos e geração de URLs pré-assinadas no R2.
  11. `users.js`: Gestão de usuários, perfis funcionais e permissões por tenant.
  12. `whatsapp.js`: Disparo de notificações e integração com o bot de atendimento.

### 2.4 Camada 4: Servidor Contínuo 24/7 (Render Container)
- **Localização:** `backend/server.js`, `backend/Dockerfile`, `backend/domains/`.
- **Tecnologias:** Node.js 18 LTS, Express, `@whiskeysockets/baileys`, `node-cron`.
- **Serviços Ativos:**
  - **Instância Multi-Tenant WhatsApp:** Conexão socket contínua para envio de avisos de cobrança, notificações de aprovação de compras e interação com clientes.
  - **Robô SINAPI Automático:** Coleta e atualização das 24 bases referenciais da Caixa/IBGE para todas as 27 UFs brasileiras.
  - **Cron Jobs de Background:** Sincronização periódica DF-e SEFAZ e limpeza de tokens expirados.

### 2.5 Camada 5: Banco de Dados Relacional (Neon Serverless PostgreSQL)
- **Localização:** `schema.sql`, `migrations/`.
- **Características:**
  - **Isolamento Multi-Tenant Físico e Lógico:** Todas as tabelas de dados possuem a chave estrangeira `tenant_id`.
  - **Row Level Security (RLS):** Assegurado pela cláusula `FORCE ROW LEVEL SECURITY` e verificação transacional da variável `app.current_tenant_id`.
  - **Dual Boundary de Acesso:** Separação entre credencial não-privilegiada de runtime (`DATABASE_URL`) e credencial de owner restrita a DDL/Bootstrap (`DATABASE_OWNER_URL`).
  - **Versionamento Declarativo:** Gerenciado por mais de 32 arquivos de migração sequenciais em `migrations/`.

---

## 3. Mapeamento de Domínios de Negócio (Bounded Contexts)

A taxonomia de negócios do FinGo é organizada em 8 domínios funcionais espelhados entre Frontend e Backend:

```
domains/
├── 1. fiscal/             # Notas Fiscais, DF-e SEFAZ, Certificados A1, Parser XML
├── 2. financeiro/         # Contas, Lançamentos, Conciliação OFX, Parcelamento, PIX, DRE
├── 3. obras/              # Cadastro de Obras/Clientes, Medições, Cronograma SLA, BIM 3D
├── 4. suprimentos/        # Pré-compras do Canteiro, Cotações, Produtos, Fornecedores
├── 5. contratos/          # Gestão de Contratos, Assinador Eletrônico, Documentação Técnica
├── 6. atendimento/        # Suporte, Chat WhatsApp Integrado, FinBot, Alertas
├── 7. gestao/             # Dashboard Executivo, Central do Gestor, Demandas, Agenda
└── 8. configuracoes/      # Dados da Construtora, Gestão de Usuários, Auditoria, SLAs
```

---

## 4. Topologia dos Dados e Esquema de Tabelas

### 4.1 Núcleo de Plataforma e Identidade
- `tenants`: Inquilinos / Construtoras contratantes (razão social, CNPJ, plano, status, vencimento).
- `usuarios`: Usuários cadastrados com `senha_hash` (scrypt), perfil RBAC, MFA secret cifrado e permissões JSONB.
- `auth_sessions`: Sessões ativas por dispositivo com identificador revogável e expiração.
- `recuperacao_senhas`: Códigos temporários de redefinição com limite de tentativas.
- `tenant_certificates`: Certificados ICP-Brasil A1 armazenados com cifragem AES-256-GCM.

### 4.2 Núcleo Operacional e Engenharia
- `obras`: Empreendimentos e obras com cliente, endereço, metragens e status.
- `obra_cadastro_geral`: Metadados técnicos, alvarás, CUB de referência e parâmetros executivos.
- `workflow_etapas` & `workflow_historico`: Máquina de estados das fases da obra com prazos e responsáveis.
- `medicoes`: Boletins de medição com deduções e retenções tributárias (INSS/ISS).
- `documentos`: Anexos com ponte para URLs do Cloudflare R2 e tipagem MIME.

### 4.3 Núcleo Financeiro e Compras
- `contas`: Contas bancárias e caixas da construtora.
- `lancamentos`: Entradas, saídas, parcelamentos e fluxo de caixa com vínculo a obras e centros de custo.
- `precompras`: Requisições de materiais e insumos vindas diretamente do canteiro.
- `fornecedores` & `produtos`: Catálogo de insumos e histórico de cotações.
- `billing_invoices`: Faturamento SaaS com chave única de transação Pix (`txid`).

---

## 5. Fluxo de Execução e Ciclo de Vida da Requisição

```
1. Usuário interage no Browser (ex: Salva Lançamento Financeiro)
   │
2. Barramento de Eventos (patch26-events.js) valida origem e aciona Lancamentos.salvar
   │
3. Persistência Local Imediata em IndexedDB (data.js) com atualização otimista da UI
   │
4. Registro na Fila de Sincronização em Nuvem (_cloudQueue)
   │
5. Envio HTTP POST /api/db com Cookie HttpOnly finobra_session_token
   │
6. Cloudflare Edge Worker valida Fail2Ban por IP, CORS e cabeçalhos de segurança
   │
7. Handler resolveAuthAndTenant() valida token, consulta status do usuário no Neon
   │
8. Permissões validadas contra RBAC (canAccessTable / canWriteData)
   │
9. Execução no Neon via _tenant-sql.js com SET LOCAL app.current_tenant_id
   │
10. Gravação na trilha de auditoria e resposta 200 OK com confirmação de versão
```

---

## 6. Governança e Regras de Operação (AGENTS.md)

1. **Deploy Exclusivo no Cloudflare Pages:** O Vercel está banido para produção. Toda distribuição web é publicada no Cloudflare Pages via `npm run build:cloudflare && npm run deploy:cloudflare`.
2. **Commit e Push Primeiro:** É terminantemente proibido disparar builds ou deploys sem que a suíte `npm test` tenha passado e que as alterações estejam commitadas e enviadas ao Git.
3. **BIM & Modelagem 3D:** Geometrias 3D procedurais e assets de IA são visuais e nunca podem ser promovidos a quantitativos autoritativos ou relatórios de engenharia sem modelo paramétrico real.
