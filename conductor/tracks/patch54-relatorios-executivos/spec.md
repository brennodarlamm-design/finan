# Trilha Patch 54.2: Relatórios Executivos PDF A4 & Excel (spec.md)

> **Contexto Conductor**  
> **Trilha:** `patch54-relatorios-executivos`  
> **Status:** Pronto para Início  
> **Data de Criação:** 2026-09-25  
> **Responsável:** Antigravity AI  
> **Pilar:** Patch 54 (Sub-trilha 2/3)

---

## 1. Problema e Justificativa

Construtoras e incorporadoras precisam reportar periodicamente o status físico-financeiro das obras para investidores, diretoria, bancos e clientes finais.  
Atualmente:
- As informações estão espalhadas em telas separadas (Dashboard, Medições, Cronograma, Lançamentos, Curva ABC).
- A exportação em PDF é básica e não segue padrões editoriais executivos para impressão em pranchas ou A4 formal.
- As exportações em Excel necessitam de estruturação em múltiplas abas com fórmulas e totalizadores profissionais para auditoria contábil.

---

## 2. Objetivos da Trilha

1. **Relatório Executivo em PDF A4 de Alta Fidelidade:**
   - Diagramação impecável no padrão do `fingo-brand-system` e visual Brutalist Tech.
   - Capa com dados do empreendimento, ART/RRT do responsável técnico e foto de destaque.
   - Sumário Executivo: % de avanço físico vs financeiro, curva S, saldo orçamentário e índice de desvio (EVM / SPI / CPI).
   - Prancha fotográfica: painel 2x2 ou 3x2 com fotos de evidências selecionadas da quinzena/mês.
   - Histórico de medições do período com retenções tributárias destacadas.

2. **Exportação Estruturada em Excel (.xlsx):**
   - Criação de pasta de trabalho multi-abas:
     1. `Resumo Executivo`: KPIs consolidados e status geral.
     2. `Cronograma & Etapas`: Lista completa de etapas com datas previstas, reais, SLAs e responsáveis.
     3. `Boletins de Medição`: Histórico analítico com detalhamento de serviços e retenções (INSS, ISS, IRRF, CSLL).
     4. `Financeiro & Custos`: Previsto x Realizado por centro de custo e insumos.
   - Formatação nativa de células (moeda BRL, datas, porcentagens e fórmulas automáticas de soma).

3. **Geração Client-Side Rápida e Serverless Friendly:**
   - Renderização limpa no navegador sem dependência de navegadores headless pesados (Puppeteer) no backend.
   - Download imediato e opção de envio direto por e-mail ou WhatsApp para os contatos cadastrados da obra.

---

## 3. Critérios de Aceite

- [ ] Motor de geração de PDF A4 em `frontend/domains/financeiro/exportar.js` e `frontend/domains/obras/obra_detalhe.js`.
- [ ] Exportador de Excel multi-abas gerando arquivo `.xlsx` válido e estruturado.
- [ ] Inclusão opcional do acervo de fotos da trilha `patch54-evidencias-campo` no relatório impresso.
- [ ] Conformidade com a CSP estrita (sem injeção de scripts inline).
- [ ] Testes automatizados validando integridade estrutural do gerador.
