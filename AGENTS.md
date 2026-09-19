# FinGo — Invariantes e Regras do Projeto (AGENTS.md)

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


---

## 🧊 Skills obrigatórias para BIM / 3D

Antes de alterar o BIM Viewer, importar modelo 3D, gerar geometria, exportar para web ou preparar clash detection:

1. Leia primeiro `.agents/skills/fingo-bim-3d-pipeline/SKILL.md`.
2. Se a tarefa envolver CAD paramétrico ou geração determinística por código, leia também `.agents/skills/build123d-cad-modeling/SKILL.md`.
3. Se a tarefa envolver conversão de imagem 2D para GLB, leia `.agents/skills/generate-3d-model/SKILL.md` e peça confirmação antes de enviar imagem, credencial ou dados para serviço externo.
4. O resultado de geração por IA é **visual/conceitual** e nunca pode ser promovido a BIM autoritativo, quantitativo, medição, orçamento ou clash de engenharia.
5. Todo asset web deve obedecer ao limite atual de upload de 15 MB e aos limites definidos nas skills.
6. Clash detection só pode ser implementado sobre geometria real carregada/tessellada com coordenadas comparáveis. Não simular resultado de interferência usando a casa procedural.
7. Use os scripts versionados das skills para geração e validação; não invente comandos nem execute scripts baixados sem revisão.
