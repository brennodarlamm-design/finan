# FinObra — Diretrizes de Workflow, Governança & Qualidade

> **Fonte Única da Verdade (Conductor Context)**  
> Versão: 1.0.0  
> Última Atualização: 2026-09-15  
> Skills Vinculadas: `tdd-architect`, `security-auditor`, `code-reviewer`, `git-commit-formatter`, `vibe-code-auditor`

---

## 1. Princípios Fundamentais

1. **Context-Driven Development (CDD)**: Toda decisão estrutural, modelo de dados ou convenção de interface deve ser documentada primeiro no diretório `conductor/`. O código é a materialização do contexto, nunca o inverso.
2. **Zero Quebra de CSP**: O FinObra opera sob política restritiva de segurança (`script-src-attr 'none'`). Nenhuma alteração pode introduzir atributos inline (`onclick`, `onchange`, `onsubmit`, `javascript:`). Toda ação deve ser registrada no Event Bridge (`js/patch26-events.js`).
3. **Zero Regressão Test-Driven**: Nenhum patch pode ser mesclado ou implantado sem que todos os testes estáticos e automatizados passem com 100% de sucesso.
4. **Resiliência contra "Vibe Code"**: Código gerado por inteligência artificial deve passar por auditoria estrita contra fragilidades estruturais, chamadas sem fallback, estados nulos e memory leaks.

---

## 2. Ciclo de Desenvolvimento (Protocolo TDD)

Para cada nova feature ou melhoria:

```text
1. [SPEC]      Definir requisitos e critérios de aceite em conductor/tracks/<track>/spec.md
2. [PLAN]      Decompor em tarefas testáveis em conductor/tracks/<track>/plan.md
3. [TEST-RED]  Criar teste automatizado em scripts/test-<track>-static.js validando o comportamento esperado
4. [CODE-GREEN]Implementar o código mínimo necessário até o teste passar
5. [REFACTOR]  Polir código, aplicar tokens do design system e otimizar queries
6. [SECURITY]  Auditar CSP, multitenancy e sanitização
7. [COMMIT]    Registrar alterações com conventional commits estruturados
```

---

## 3. Gates de Verificação Obrigatórios

Antes de declarar qualquer entrega como concluída, execute a suíte de verificação:

```bash
# 1. Testes do Barramento de Eventos e CSP Estrito
npm run test:patch26

# 2. Testes de Workflow, SLAs e Notificações
npm run test:patch53

# 3. Teste Mestre de Conformidade (Conductor, Tokens, LLMs)
npm run test:improvement

# 4. Suíte Geral de Testes Estáticos
npm test
```

Se qualquer teste falhar, o avanço é **bloqueado** até a resolução da não-conformidade.

---

## 4. Política de Commits Semânticos (Sentry / Conventional Commits)

Os commits devem seguir rigorosamente o padrão:

```text
<tipo>(<escopo>): <descrição curta no imperativo>

[corpo opcional explicando motivação e decisões de design]
```

### Tipos Permitidos:
- `feat`: Nova funcionalidade para o usuário ou operador.
- `fix`: Correção de bug ou falha de sistema.
- `perf`: Melhoria de performance, query tuning ou redução de egress no Neon DB.
- `style`: Ajustes visuais, tokens de CSS, alinhamento de layout ou micro-interações sem alteração lógica.
- `refactor`: Refatoração interna de código sem alteração no comportamento externo.
- `sec`: Ajustes de segurança, sanitização, regras CSP ou criptografia.
- `test`: Criação ou atualização de suites de testes automatizados.
- `docs`: Documentação técnica, `llms.txt` ou atualizações no diretório `conductor/`.

### Exemplos Válidos:
- `feat(workflow): implementar disparo em cascata de etapas sucessoras`
- `style(kpi): modernizar cards de métricas com números tabulares e double-bezel`
- `perf(neon): eliminar SELECT * em endpoints de listagem de processos`
- `sec(csp): registrar handler data-fb-click no barramento de eventos`
- `docs(conductor): documentar bounded contexts e arquitetura em tech-stack.md`
