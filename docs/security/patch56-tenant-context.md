# Patch 56 — contexto tenant e preparação para FORCE RLS

## Objetivo

Preparar o FinObra para executar a aplicação com um role PostgreSQL sem `BYPASSRLS`, mantendo isolamento por tenant no próprio banco.

## Estratégia

O driver HTTP do Neon não preserva estado de sessão entre chamadas independentes. Por isso o contexto RLS precisa ser aplicado na **mesma transação** da query protegida.

`api/_tenant-sql.js` executa, para cada operação:

1. `set_config('app.current_tenant_id', tenantId, true)`;
2. `set_config('app.is_system', 'false'|'true', true)`;
3. query da aplicação.

O terceiro argumento `true` torna as configurações locais à transação, evitando vazamento de contexto entre requisições concorrentes.

## Fail-closed

- requisição comum sem `tenantId` resolvido não recebe cliente SQL;
- `isSystem=true` precisa ser explícito;
- SQL bruto fora de tagged template é rejeitado pelo wrapper;
- filtros explícitos `WHERE tenant_id = ...` continuam no código como defesa em profundidade.

## Rotas já migradas

- `api/db.js` — API central de dados, snapshot, delta sync e mutações;
- `api/dashboard.js` — agregações financeiras, obras, notas e medições;
- `api/upload.js` — leitura/exclusão de metadados de documentos e validação de posse;
- `api/_workflow.js` — workflow de obras, cadastro geral, CUB, cláusulas, histórico e etapas.

## Validação automatizada

`scripts/test-patch56-tenant-context.js` valida:

- contexto `app.current_tenant_id` e `app.is_system` na mesma transação;
- ausência de contexto persistente de sessão;
- falha fechada sem tenant;
- modo system apenas explícito;
- tagged template obrigatório;
- integração estática das rotas migradas;
- manutenção dos filtros `tenant_id` existentes.

No head validado desta fase, passaram:

- FinObra security regression;
- full test suite;
- syntax verification;
- Cloudflare Pages migration/build.

## Ainda pendente antes de `finobra_app` + FORCE RLS

- migrar `api/users.js` e fluxos de suporte/tenant embutidos;
- adaptar a validação online em `api/_auth.js` sem quebrar impersonação Master;
- revisar rotas auxiliares de workflow multiplexadas em `/api/audit`;
- revisar demais endpoints multi-tenant (`assinaturas`, `plano` e rotas administrativas que operam dados de tenant);
- executar testes reais Tenant A × Tenant B em branch Neon isolada;
- criar role `finobra_app` sem `BYPASSRLS`;
- trocar o runtime para o novo role;
- somente então considerar `FORCE ROW LEVEL SECURITY`.

## Banco de produção

Nenhuma mudança desta fase deve ser aplicada diretamente no Neon de produção antes da validação em branch isolada. A migration 030, criação do role de aplicação e FORCE RLS permanecem pendentes.

O projeto Neon está atualmente com o limite prático de branches ocupado por previews existentes, portanto o teste estrutural de RLS continua bloqueado até haver uma branch de teste disponível.
