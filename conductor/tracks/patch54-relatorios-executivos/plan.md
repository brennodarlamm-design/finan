# Plano de Execução: Relatórios Executivos PDF A4 & Excel (plan.md)

> **Contexto Conductor**  
> **Trilha:** `patch54-relatorios-executivos`  
> **Status:** Pronto para Início  
> **Data:** 2026-09-25  

---

## Fases de Execução

### Fase 1: Arquitetura do Relatório Executivo PDF A4
- [ ] Desenhar o template visual A4 (HTML/CSS com `@media print` otimizado para margens de 10mm).
- [ ] Criar gerador de sumário executivo com:
  - Cabeçalho com logo da construtora e dados da obra.
  - Tabela resumo de avanço físico-financeiro e gráfico de Curva S em SVG leve.
  - Grid de fotos de evidências recentes do canteiro.
  - Tabela de medições aprovadas no período.
- [ ] Implementar em `frontend/domains/obras/obra_detalhe.js` e espelhar em `js/obra_detalhe.js`.

### Fase 2: Estruturação da Planilha Multi-Abas (.xlsx)
- [ ] Implementar construtor de planilhas nativo em `frontend/domains/financeiro/exportar.js`.
- [ ] Estruturar as 4 abas canônicas: `Resumo`, `Cronograma`, `Medições`, `Custos`.
- [ ] Aplicar estilos de cabeçalho, larguras de coluna ajustadas e formatação monetária padrão BRL (`R$ #,##0.00`).

### Fase 3: Ações de Compartilhamento & Disparo
- [ ] Criar modal de exportação executiva permitindo selecionar período e seções a incluir.
- [ ] Integrar botão de compartilhamento rápido:
  - Download local direto.
  - Envio do link/arquivo para o cliente da obra via WhatsApp (Evolution Go) ou e-mail (Resend).

### Fase 4: Validação, Testes e Homologação
- [ ] Criar script de teste automatizado `scripts/test-patch54-relatorios.js`.
- [ ] Validar conformidade de layout e geração de binários sem vazamento de memória.
- [ ] Executar suíte `npm run test:fast`.
- [ ] Commit semântico, push e deploy conforme `AGENTS.md`.
