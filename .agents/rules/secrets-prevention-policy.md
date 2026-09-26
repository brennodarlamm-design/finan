# Política Inegociável: Prevenção Total de Vazamento de Segredos e Credenciais

> **REGRA DE OURO:** Sob nenhuma circunstância, qualquer agente, script ou desenvolvedor pode escrever, salvar, documentar ou commitar credenciais reais, senhas, tokens de API, strings de conexão com senha ou chaves privadas em arquivos rastreados pelo Git (`.md`, `.js`, `.ts`, `.json`, `.yml`, etc.).

---

## 🚨 Padrões Terminantemente Proibidos no Código e Documentação

1. **Strings de Conexão com Senhas:**
   - ❌ **PROIBIDO:** `postgresql://usuario:senha_real@ep-xxxx.neon.tech/...`
   - ✅ **CORRETO:** `process.env.DATABASE_URL` ou `postgresql://[USER]:[PASS]@[HOST]/neondb`
2. **Senhas de Banco de Dados:**
   - ❌ **PROIBIDO:** Senhas com prefixo `npg_`, `fingo_app_`, senhas de root, etc.
   - ✅ **CORRETO:** Guardadas exclusivamente no `.env.local` (ignorado no git) ou no gerenciador de segredos em nuvem.
3. **Chaves de API e Tokens:**
   - ❌ **PROIBIDO:** Chaves reais do Render (`rnd_`), OpenAI (`sk-`), Gemini, Google, Cloudflare, Resend, Sentry.
   - ✅ **CORRETO:** Carregadas estritamente via `process.env.NOME_DA_VARIAVEL`.
4. **Documentação de Arquitetura (`docs/*.md`):**
   - ❌ **PROIBIDO:** Exemplos contendo credenciais reais ou endpoints com senhas.
   - ✅ **CORRETO:** Apenas topologia, variáveis de ambiente utilizadas (nomes de chaves) e placeholders como `[REDACTED]`.

---

## 🛡️ Camadas de Proteção Automáticas Ativas

1. **Gate 0 de Segurança no `npm run test:fast`:**
   - O scanner `scripts/security-secrets-scanner.cjs` varre todos os arquivos do repositório antes de rodar os testes.
   - Se qualquer senha ou string de conexão for encontrada, o processo é abortado imediatamente com código de erro 1.
2. **Separação Rígida de Ambientes:**
   - `.env.local` e `.secrets.temp.json` estão e devem permanecer no `.gitignore`.
   - Scripts de sincronização (`sync-render-secrets.js`, `sync-cloudflare-secrets.js`, `update-render-neon.js`) devem ler de `process.env` e nunca conter valores fixos.
