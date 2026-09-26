# FinGo — Arquitetura Dual Neon: Separação de Cargas (Workload Split)

> **Palavra-chave para Ativação:** `ATIVAR DUAL NEON`  
> **Comando CLI Direto:** `node scripts/activate-dual-neon.js`  
> **Data de Aplicação:** Início de cada ciclo mensal (quando a cota do Banco Antigo resetar)

---

## 1. Visão Geral da Arquitetura

O FinGo possui dois serviços principais que utilizam banco de dados PostgreSQL:
1. **FinGo SaaS Core (`finan-backend`):** Sistema financeiro, medições, orçamentos, SINAPI, notas fiscais, auditoria e isolamento multi-tenant (RLS estrito com 33 tabelas).
2. **Motor do WhatsApp (`fingo-evolution-go`):** Gerenciador de instâncias, webhooks contínuos de mensagens, eventos de conexão e filas do WhatsApp.

Em vez de dividir requisições de forma cega entre dois bancos (o que causaria inconsistência de dados / *split-brain*), a arquitetura **Dual Neon** adota **Separação de Workload por Domínio**:

```
                              ┌─────────────────────────────┐
                              │        CLOUDFLARE EDGE      │
                              │       https://fingo.api.br  │
                              └──────────────┬──────────────┘
                                             │
                                             ▼
                              ┌─────────────────────────────┐
                              │    FinGo Backend (Render)   │
                              │     srv-dak05l8jo6nc73fh98cg│
                              └──────────────┬──────────────┘
                                             │
                     ┌───────────────────────┴───────────────────────┐
                     │                                               │
                     ▼                                               ▼
       ┌───────────────────────────┐                   ┌───────────────────────────┐
       │   BANCO NOVO (Neon 1)     │                   │   BANCO ANTIGO (Neon 2)   │
       │   Região: us-east-2       │                   │   Região: sa-east-1       │
       │   Cota: 100 CU-horas/mês  │                   │   Cota: 100 CU-horas/mês  │
       ├───────────────────────────┤                   ├───────────────────────────┤
       │ • 7 Tenants Cadastrados   │                   │ • Evolution Go WhatsApp   │
       │ • Usuários & Permissões   │                   │ • Tabelas instances       │
       │ • Lançamentos & Contas    │                   │ • Mensagens & Webhooks    │
       │ • Obras & Medições        │                   │ • Configuração runtime    │
       │ • Bases SINAPI Oficiais   │                   │ • Sessões Baileys/Meow    │
       │ • RLS e Least Privilege   │                   │                           │
       └───────────────────────────┘                   └───────────────────────────┘
```

---

## 2. Benefícios Estratégicos

1. **200 Horas de CPU Mensais sem Custo:** Cada projeto Neon gratuito possui 100 CU-horas. Com 2 projetos independentes, o FinGo passa a dispor de 200 horas de computação gratuita todo mês.
2. **Imunidade Contra Picos de Mensagens:** O tráfego intenso do WhatsApp (troca constante de pings, digitação, status de presença e webhooks) consome CPU de forma contínua. Separando esse motor no Banco 2, o sistema financeiro da construtora fica 100% blindado contra lentidão ou interrupção.
3. **Hibernação Inteligente (Scale-to-Zero):**
   - Nas madrugadas ou horários sem tráfego de mensagens, o Banco 2 hiberne automaticamente.
   - Fora do horário de expediente, o Banco 1 hiberne automaticamente.
   - Ambas as cotas duram o mês inteiro com folga.
4. **Zero Risco de Conflito de Dados:** O schema do Evolution Go (`instances`, `messages`, `runtime_configs`) não se sobrepõe com as tabelas de negócio do FinGo (`tenants`, `obras`, `contratos`).

---

## 3. Identificação dos Bancos

| Propriedade | Banco 1 (Novo — SaaS Core) | Banco 2 (Antigo — WhatsApp) |
|---|---|---|
| **Ambiente** | Produção Core SaaS | Motor Evolution Go |
| **Endpoint Pooler** | `ep-flat-fire-b4qu9c7p-pooler.c-6.us-east-2.aws.neon.tech` | `ep-solitary-river-ach3x8za-pooler.sa-east-1.aws.neon.tech` |
| **Endpoint Direto** | `ep-flat-fire-b4qu9c7p.c-6.us-east-2.aws.neon.tech` | `ep-solitary-river-ach3x8za.sa-east-1.aws.neon.tech` |
| **Serviço Render** | `finan-backend` (`srv-dak05l8jo6nc73fh98cg`) | `fingo-evolution-go` (`srv-dart4pnpn0mc73dufvcg`) |
| **Variáveis Utilizadas** | `DATABASE_URL`<br>`DATABASE_OWNER_URL`<br>`DATABASE_URL_UNPOOLED` | `POSTGRES_AUTH_DB`<br>`POSTGRES_USERS_DB` |

---

## 4. Como Ativar no Início do Mês

Assim que a cota gratuita do Banco Antigo for renovada (geralmente no dia 1º de cada mês), você pode ativar a separação de duas maneiras:

### Opção A: Pelo Chat com a IA (Mais Prático)
Basta digitar no chat do agente:
> **`ATIVAR DUAL NEON`**

O agente irá:
1. Testar se o Banco Antigo já respondeu e saiu do estado de bloqueio de cota.
2. Atualizar as variáveis de ambiente no Render via API.
3. Reiniciar o serviço do Evolution Go.
4. Validar o status de saúde e a licença ativa.

### Opção B: Via Terminal / Linha de Comando
Execute na raiz do projeto:
```powershell
node scripts/activate-dual-neon.js
```

---

## 5. Procedimento de Reversão / Contingência (Se Necessário)

Se em algum momento o Banco Antigo esgotar suas horas antes do fim do mês, basta retornar o Evolution Go para o Banco Novo executando:
```powershell
node scripts/update-render-neon.js
```
Isso reconecta o Evolution Go ao Banco 1 em segundos, sem interromper as operações do SaaS.
