# Patch 56 — Fase B: contexto tenant para RLS

## Objetivo

Preparar o runtime do FinObra para deixar de depender de `neondb_owner` e operar futuramente com um role `finobra_app` sem `BYPASSRLS`, usando `FORCE ROW LEVEL SECURITY` nas tabelas multi-tenant.

## Problema identificado

O FinObra usa `@neondatabase/serverless` com o driver HTTP. Esse modelo não deve depender de estado de sessão entre duas queries independentes. Portanto, fazer `SET app.current_tenant_id = ...` em uma chamada e executar a consulta em outra não é seguro: a próxima chamada pode não usar a mesma sessão/transaction do PostgreSQL.

## Estratégia escolhida

Foi criado `api/_tenant-sql.js`.

Cada query tenant-scoped será executada dentro de uma única transação Neon contendo primeiro:

```sql
SELECT
  set_config('app.current_tenant_id', '<tenant>', true),
  set_config('app.is_system', 'false', true);
```

E, em seguida, a query real.

O terceiro argumento `true` em `set_config` é equivalente a contexto local da transação. Assim o tenant não vaza para a requisição seguinte.

Para operações internas explicitamente autenticadas como sistema, `app.is_system` pode ser `true`; isso nunca é inferido pela ausência de tenant.

## Regras de segurança

- Chamadas comuns sem `tenantId` falham fechado.
- `isSystem=true` precisa ser explícito.
- Tenant e flags entram como bind parameters.
- O wrapper não aceita SQL bruto; somente tagged templates.
- O contexto e a query protegida devem estar na mesma transação.
- Nenhuma troca de `DATABASE_URL` para `finobra_app` deve acontecer antes de todas as rotas tenant críticas estarem adaptadas e testadas.

## Ordem de rollout

1. Criar e testar o wrapper tenant-scoped. **Em andamento nesta branch.**
2. Integrar primeiro em rotas de dados multi-tenant (`api/db.js`) mantendo os filtros `WHERE tenant_id = ...` como defesa em profundidade.
3. Integrar documentos/upload e demais rotas tenant.
4. Criar suíte de isolamento cruzado A/B para dois tenants.
5. Criar `finobra_app` em ambiente Neon isolado, sem `BYPASSRLS`.
6. Conceder somente privilégios necessários ao role da aplicação.
7. Habilitar/forçar RLS no ambiente isolado e validar CRUD, sync, workflow, contratos, financeiro e documentos.
8. Validar jobs internos com contexto `app.is_system=true` apenas onde necessário.
9. Só então trocar a conexão de runtime para `finobra_app` em produção.
10. Após smoke tests, aplicar `FORCE RLS` em produção e revogar acessos desnecessários.

## Critério para promover para produção

A Fase B só pode ser considerada pronta quando:

- nenhum endpoint tenant crítico depender de `neondb_owner` para burlar RLS;
- os testes provarem que tenant A não lê/altera dados do tenant B mesmo que um filtro de aplicação seja removido acidentalmente;
- Master/jobs internos funcionarem apenas pelo caminho explícito de sistema;
- a aplicação funcionar com `finobra_app` sem `BYPASSRLS` em ambiente isolado;
- CI e smoke tests estiverem verdes.
