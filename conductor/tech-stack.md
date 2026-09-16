# FinObra — Arquitetura Técnica & Stack Tecnológico

> **Fonte Única da Verdade (Conductor Context)**  
> Versão: 1.0.0  
> Última Atualização: 2026-09-15  
> Skills Vinculadas: `architecture-patterns`, `neon-postgres`, `neon-postgres-egress-optimizer`, `api-design-principles`, `api-security-best-practices`, `design-system`

---

## 1. Visão Geral da Arquitetura

O FinObra adota uma arquitetura em camadas orientada a serviços leves (*Serverless First*), projetada para alta disponibilidade, segurança criptográfica estrita e custos previsíveis.

```text
┌─────────────────────────────────────────────────────────────┐
│             CAMADA DE APRESENTAÇÃO (FRONTEND)               │
│  • Vanilla ES6 Modules com Carregamento Sob Demanda         │
│  • Barramento de Eventos Declarativo (data-fb-*)            │
│  • Design Tokens CSS (Inspirados em Tailwind v4)            │
│  • CSP Rigoroso: script-src-attr 'none'                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON REST APIs
┌──────────────────────────────▼──────────────────────────────┐
│             CAMADA DE APLICAÇÃO (SERVERLESS)                │
│  • Vercel Serverless Functions (Node.js 18+)                │
│  • Autenticação Criptográfica (JWT / Sessões / TOTP 2FA)     │
│  • Sanitização e Validação Estrita de Schemas               │
│  • Isolamento Obrigatório de Multitenancy (empresa_id)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ Pooler TCP / TLS (Neon Pooler)
┌──────────────────────────────▼──────────────────────────────┐
│             CAMADA DE DADOS (NEON POSTGRESQL)               │
│  • Lakebase Serverless Postgres (Autoscaling & Scale-to-Zero)│
│  • Connection Pooling com sslmode=require                   │
│  • Índices Estratégicos (empresa_id, obra_id, status)       │
│  • Egress Optimization: Projeções explícitas de colunas     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend & Sistema de Design

- **Core**: HTML5 Semântico + Vanilla JavaScript moderno (ES2022+). Não há acoplamento a bundlers proprietários para manter velocidade de carregamento instantânea.
- **Design System & Tokens**:
  - Definidos em `css/style.css`.
  - Base de cores: Olive/Zinc Dark Mode (`#090C07`, `#0E1209`, `#151A10`), Electric Teal Accent (`#12D9A0`), Emerald positivo, Amber aviso, Rose alerta.
  - Escala de espaçamento estrita base 4px/8px (`gap-2`, `gap-4`, `p-4`, `p-6`).
  - Haptic Depth: Utilização do padrão **Double-Bezel** (casca externa translúcida + núcleo maquinado) com sombras ambientais suaves.
  - Tipografia: Inter / Plus Jakarta Sans com suporte a algarismos tabulares (`font-feature-settings: 'tnum' 1`).
- **Barramento de Eventos & Segurança CSP**:
  - A aplicação implementa Content Security Policy restritivo: `script-src-attr 'none'`.
  - Proibido uso de atributos inline (`onclick`, `onchange`, etc.).
  - Toda interatividade é orquestrada via `data-fb-click`, `data-fb-change`, `data-fb-submit` gerenciados centralizadamente pelo arquivo `js/patch26-events.js`.

---

## 3. Backend & Camada de APIs

- **Ambiente**: Node.js rodando em Serverless Functions na Vercel (`/api/*`).
- **Padrão RESTful**:
  - Contrato de retorno padronizado:
    ```json
    {
      "success": true,
      "data": { ... },
      "timestamp": "2026-09-15T19:40:00.000Z"
    }
    ```
  - Tratamento de erro uniforme:
    ```json
    {
      "success": false,
      "error": "Mensagem descritiva e segura",
      "code": "SLUG_DO_ERRO",
      "timestamp": "2026-09-15T19:40:00.000Z"
    }
    ```
- **Segurança de API**:
  - Sanitização de strings contra XSS.
  - Validação de tipos primitivos (inteiros, UUIDs, enums válidos).
  - Rate limiting e proteção contra brute-force nas rotas sensíveis de login e 2FA.

---

## 4. Banco de Dados: Neon PostgreSQL

- **Provedor**: Neon Serverless Postgres.
- **Connection Pooling**:
  - String de conexão com `-pooler` ativado para evitar esgotamento de conexões em concorrência serverless.
  - Modo TLS obrigatório (`sslmode=require`).
- **Otimização de Egress & Custos**:
  - Nenhuma consulta de listagem ou relatório deve utilizar `SELECT *`.
  - Projeções explícitas de colunas (`SELECT id, nome, status, data_limite FROM ...`).
  - Paginação obrigatória em coleções de alto volume (extratos bancários, históricos de workflow, diário de obra).
- **Esquema Multitenant Seguro**:
  - Toda tabela operacional possui a coluna `empresa_id INT NOT NULL REFERENCES empresas(id)`.
  - Todas as queries de escrita e leitura filtram impreterivelmente `WHERE empresa_id = $1`.

---

## 5. Integrações Externas

1. **SEFAZ / Receita Federal**:
   - Conexão mTLS com Certificado Digital A1 (.pfx / .p12).
   - Consulta e download assíncrono de XMLs de NF-e e CT-e.
2. **Caixa Econômica Federal / SINAPI**:
   - Snapshots das tabelas de insumos e composições por estado (UF), mantendo rastreabilidade histórica dos orçamentos contratados.
3. **WhatsApp / Baileys**:
   - Webhook e API REST para notificações operacionais e cobranças amigáveis de SLAs de obra.
