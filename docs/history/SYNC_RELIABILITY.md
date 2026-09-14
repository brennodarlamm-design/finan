# Confiabilidade da sincronização

## Alterações

- Após o bootstrap, snapshots completos removem registros excluídos em outro dispositivo. Saves pendentes e rascunhos em atenção continuam preservados, inclusive quando o cache foi expurgado.
- Snapshots interrompidos, paginação incompleta e leituras sobrepostas a alterações locais não devem substituir o cache.
- Lançamentos retornam `sync_version`, obtida da versão da linha no PostgreSQL. Saves individuais e em lote comparam essa versão atomicamente antes de atualizar. Uma gravação idêntica pode ser repetida com segurança; uma edição antiga diferente retorna `SYNC_CONFLICT` (409 individual, falha por item no lote).
- A confirmação atualiza a versão no cache e na próxima edição pendente. Confirmações antigas não apagam edições posteriores, inclusive no mesmo milissegundo.
- Em “Sincronizações que requerem atenção”, “Revisar conflito” permite comparar as versões e escolher qual manter. Uma nova alteração concorrente durante a revisão será rejeitada novamente pelo servidor.
- Rotas HTML diretas passam pelo Worker. URLs antigas do app e login redirecionam às rotas canônicas.

## Compatibilidade e publicação

Não há migração de schema. Publicar backend e frontend na mesma entrega. Abas antigas devem ser recarregadas: clientes sem `sync_version` podem criar lançamentos e repetir dados idênticos, mas não sobrescrever lançamentos existentes com conteúdo diferente. Esses casos são preservados para revisão, não atualizados silenciosamente.

A proteção de concorrência desta entrega cobre os saves de **lançamentos**, individuais e em lote. Estendê-la aos demais módulos e às exclusões exige uma próxima etapa. A otimização de carregamento dos módulos também permanece separada.

`sync_version` é um token de comparação, não um contador de negócio nem uma identificação permanente. Consulte a documentação PostgreSQL de [colunas de sistema](https://www.postgresql.org/docs/17/ddl-system-columns.html) e [INSERT/RETURNING](https://www.postgresql.org/docs/18/sql-insert.html).

## Validação

`node scripts/test-sync-behavior.js` executa as duas consultas reais da API em PGlite, um PostgreSQL local em memória, sem credenciais nem dados de produção. Cobre conflitos entre versões, repetição de requisições, isolamento por tenant, registro excluído, reconciliação offline, confirmação sobreposta a edição, revisão e roteamento do Worker.

O teste faz parte de `npm test`. Complementar com `node scripts/check-all-syntax.js` e `npm run build:cloudflare`. Os testes locais não substituem uma homologação com duas sessões reais antes de publicar.
