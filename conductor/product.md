# FinObra — Visão de Produto, Domínio & Bounded Contexts

> **Fonte Única da Verdade (Conductor Context)**  
> Versão: 1.0.0  
> Última Atualização: 2026-09-15  
> Metodologia: Domain-Driven Design (DDD) & Context-Driven Development (CDD)

---

## 1. Visão Geral do Produto

O **FinObra** é uma plataforma SaaS B2B "tudo-em-um" desenvolvida especificamente para a cadeia da construção civil — construtoras de pequeno, médio e grande porte, incorporadoras, escritórios de arquitetura e engenharia civil.

O principal diferencial do FinObra é a união orgânica entre **Gestão Financeira Multitenant Rigorosa**, **Engenharia de Custos com Base Oficial SINAPI (CEF/IBGE)**, **Controle Físico-Financeiro de Medições**, **Workflow Operacional com Gestão de Prazos e SLAs em Cascata**, **Monitoramento Fiscal SEFAZ (Certificado A1)** e **Comunicação Ativa via WhatsApp**.

---

## 2. Personas & Perfis de Usuário

| Perfil | Necessidades Centrais | Módulos Mais Utilizados |
| :--- | :--- | :--- |
| **Diretor / Gestor Financeiro** | Visão macro de fluxo de caixa, DRE gerencial em tempo real, liquidez bancária consolidada, conciliação OFX rápida e controle de retenções tributárias. | Dashboard Financeiro, DRE, Conciliação OFX, Lançamentos, Contas Bancárias. |
| **Engenheiro Coordenador / Gestor de Obra** | Acompanhamento de todas as obras ativas, identificação de gargalos e desvios de SLA, cobrança de responsáveis e histórico de apontamentos. | Central do Gestor, Cronograma SLA, Boletins de Medição, Diário de Obra. |
| **Arquiteto / Projetista / Técnico de Campo** | Foco nas suas demandas pontuais (etapas pendentes, em andamento, vencidas), facilidade para registrar apontamentos e anexar evidências. | Minhas Demandas, Cronograma da Obra, Notificações WhatsApp. |
| **Orçamentista / Planejador de Custos** | Elaboração precisa de orçamentos com base SINAPI oficial (desonerado/não desonerado), aplicação de BDI e leis sociais com fórmulas auditáveis. | Módulo SINAPI, Orçamentos da Obra, Banco de Insumos e Composições. |
| **Administrador do Sistema** | Gestão multitenant, controle de permissões por cargo, configuração de templates de workflow, auditoria e segurança 2FA. | Configurações, Segurança & 2FA, Gestão de Usuários, Templates de SLA. |

---

## 3. Bounded Contexts (Modelagem DDD Estratégica)

O sistema é compartimentado em 6 Bounded Contexts fundamentais:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                               FINOBRA SAAS                             │
├─────────────────────┬─────────────────────┬────────────────────────────┤
│ 1. Contexto         │ 2. Contexto         │ 3. Contexto                │
│    Financeiro       │    Engenharia &     │    Medições &              │
│    & Caixa          │    Custos (SINAPI)  │    Faturamento             │
│    • Contas a Pagar │    • Base Oficial   │    • Boletins de Medição   │
│    • Contas a Rec.  │    • Composições    │    • Acumulado Físico/Fin  │
│    • Extrato & OFX  │    • BDI & Encargos │    • Retenções Técnicas    │
├─────────────────────┼─────────────────────┼────────────────────────────┤
│ 4. Contexto         │ 5. Contexto         │ 6. Contexto                │
│    Workflow & SLAs  │    Comunicação &    │    Fiscal &                │
│    • Motor Cascata  │    Notificações     │    Conformidade            │
│    • Kanban/Gantt   │    • Baileys API    │    • SEFAZ Monitor A1      │
│    • Minhas Demanda │    • WhatsApp Web   │    • Importação XML NF-e   │
│    • Central Gestor │    • Alertas Prazo  │    • CSP & Auditoria SHA   │
└─────────────────────┴─────────────────────┴────────────────────────────┘
```

### 3.1 Contexto Financeiro & Caixa
- **Entidades Centrais**: `Lancamento` (Receita/Despesa), `ContaBancaria`, `PlanoDeContas`, `ConciliacaoOFX`.
- **Invariantes de Negócio**:
  - Todo lançamento pertence estritamente a uma `empresa_id` e opcionalmente a uma `obra_id`.
  - Saldos bancários são calculados com base na data de liquidação/competência.
  - Conciliação bancária marca hashes de transações para evitar duplicidade de lançamentos.

### 3.2 Contexto Engenharia & Custos (SINAPI)
- **Entidades Centrais**: `Orcamento`, `ItemOrcamento`, `ComposicaoSINAPI`, `InsumoSINAPI`.
- **Invariantes de Negócio**:
  - Dados oficiais da CEF/IBGE são tratados como snapshots históricos imutáveis por mês/ano e UF.
  - Cálculo de BDI diferencia materiais de serviços conforme orientações do TCU.

### 3.3 Contexto Medições & Faturamento
- **Entidades Centrais**: `Medicao`, `ItemMedicao`, `RetencaoTecnica` (ISS, INSS, IRRF, PIS/COFINS/CSLL).
- **Invariantes de Negócio**:
  - O percentual medido no período somado ao medido anterior não pode ultrapassar 100% do saldo contratual sem aditivo.
  - Retenções na fonte reduzem o valor líquido liberado para pagamento do empreiteiro.

### 3.4 Contexto Workflow & Prazos (SLA)
- **Entidades Centrais**: `CronogramaProcesso`, `TemplateWorkflow`, `ApontamentoHistorico`, `ChecklistItem`.
- **Invariantes de Negócio**:
  - Etapas operam em cadeia de dependência (`ordem` sequencial ou sucessores explícitos).
  - A conclusão de uma etapa dispara automaticamente o início da próxima (motor em cascata).
  - Prazos são controlados por semáforos: `no_prazo` (verde), `alerta` (amarelo, faltam ≤ 2 dias), `atrasada` (vermelho) ou `concluida`.

### 3.5 Contexto Comunicação & Notificações
- **Entidades Centrais**: `NotificacaoFila`, `DisparoWhatsApp`, `TemplateMensagem`.
- **Invariantes de Negócio**:
  - Mensagens transacionais são formatadas com saudação, contexto da obra, prazo e CTA amigável.
  - Modo híbrido: disparo direto via API Baileys da construtora ou fallback via deep-link WhatsApp Web (`api.whatsapp.com/send`).

### 3.6 Contexto Fiscal & Conformidade
- **Entidades Centrais**: `NfeNota`, `CertificadoA1`, `RegistroAuditoria`.
- **Invariantes de Negócio**:
  - Certificados digitais A1 são armazenados com encriptação AES-256 e protegidos contra extração.
  - Todo documento emitido com assinatura digital possui hash SHA-256 validável publicamente.

---

## 4. Metas de Negócio e Indicadores de Sucesso

1. **Eficiência Operacional**: Reduzir em pelo menos 60% o tempo gasto por engenheiros e gestores na consolidação de prazos e planilhas financeiras.
2. **Zero Inadimplência de Prazos Oculta**: Todo atraso de cronograma deve ser visível instantaneamente na Central do Gestor e no WhatsApp do responsável.
3. **Confiabilidade Extrema**: 100% dos dados financeiros e operacionais isolados por multitenancy seguro no Neon PostgreSQL com zero vazamento entre empresas.
