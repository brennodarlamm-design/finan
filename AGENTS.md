# FinObra — Invariantes e Regras do Projeto (AGENTS.md)

Este documento define regras inegociáveis para o desenvolvimento e operação deste repositório. Todos os agentes e ferramentas devem obedecer a estas instruções rigorosamente.

---

## 🚨 Regra Inegociável: Commit ANTES de Qualquer Deploy

> **ORDEM OBRIGATÓRIA DE OPERAÇÕES:**
> 1. **Implementação & Testes:** Validar todas as alterações com os testes automatizados da suíte.
> 2. **Commit / Comentário Primeiro:** Realizar SEMPRE o `git commit` com mensagem semântica detalhada e clara.
> 3. **Push para o Repositório:** Sincronizar os commits locais com o repositório remoto via `git push`.
> 4. **Deploy SOMENTE Depois:** Qualquer comando de build de distribuição ou deploy em produção (`npm run deploy`, `node scripts/deploy.js`, etc.) **SÓ PODE SER EXECUTADO APÓS O COMMIT E O PUSH ESTAREM CONCLUÍDOS**.
>
> ❌ **NUNCA**, sob nenhuma circunstância, disparar rotinas de deploy, build de produção ou publicação em ambiente remoto com alterações pendentes ou sem o commit previamente realizado e confirmado.
