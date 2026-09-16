# Entrada após o login — etapa inicial de desempenho

## Problema e solução

O HTML de `/app` continha um `app-root` vazio. A primeira interface dependia
da execução de todos os scripts `defer`, da validação da sessão e da consulta
sequencial a `/api/plano`, que também calcula consumo e informações de cobrança.

Agora o HTML contém uma estrutura pública de carregamento, responsiva e sem
dados da empresa. A sessão começa a ser validada assim que `auth.js` executa,
em paralelo ao restante da inicialização. `App.init` reutiliza essa promessa.

`GET /api/auth?action=me` devolve as regras do plano do tenant efetivo, inclusive
em impersonação. Não consulta contagens ou faturas para construir essa resposta.
O cliente só consulta `/api/plano` na entrada quando a API ainda é de uma versão
anterior, sem o campo `plan`. A área de cobrança mantém a consulta detalhada.

Falhas online interrompem a abertura antes de `DB.init` e `renderShell`, com
opção de recarregar. As consultas de acesso têm timeout de 12 segundos. Uma
demora de inicialização superior a 20 segundos revela ações de recuperação.
O comportamento offline existente foi preservado; esta etapa não redefine a
política de acesso offline.

Chart.js, OFX e os auxiliares de bancos, modelos e propostas de orçamento são
carregados sob demanda. As dependências do SINAPI e os handlers CSP resolvem
corretamente módulos carregados depois da abertura.

## Evidência local

Comparação dos scripts referenciados diretamente por `app.html` com o commit
anterior a esta implementação, somando o tamanho dos arquivos sem compressão:

| Medida | Antes | Depois |
|---|---:|---:|
| Scripts na entrada | 53 | 49 |
| Bytes de JavaScript na entrada | 2.248.252 | 1.905.266 |
| Espera artificial após login | 350 ms | 0 ms |

O delta de 342.986 bytes (~15,3%) se refere ao caminho inicial, não à transferência
comprimida nem ao total de uma visita: o dashboard ainda baixa Chart.js depois
da estrutura aparecer. Não representa uma medição de latência em produção.

Validação automatizada: `npm test`, `node scripts/check-all-syntax.js` e
`git diff --check`. Os novos testes cobrem timeout, sessão inválida, plano do
tenant efetivo, compatibilidade de API, reutilização de requisição e ações
carregadas sob demanda.

Validação no navegador com servidor local e dados sintéticos:

- Resposta de sessão atrasada em 10 segundos: estrutura inicial visível e nenhum
  conteúdo privado antes da resposta.
- Desktop e viewport de 390 × 844: sem tela vazia ou overflow horizontal inicial.
- Dashboard: nenhuma requisição a `/api/plano` com resposta consolidada.
- OFX e Orçamentos: módulos abrem depois do download sob demanda.
- Resposta 503: mensagem de recuperação, sem abrir cache privado.
- Resposta 401: sessão local removida e redirecionamento ao login.

## Medição depois da publicação

No console do navegador:

```js
performance.getEntriesByType('measure')
  .filter(entry => entry.name.startsWith('finobra:'))
  .map(({ name, duration }) => ({ name, milliseconds: Math.round(duration) }));
```

- `finobra:session-access`: validação da sessão e acesso, incluindo fallback
  de plano quando necessário.
- `finobra:navigation-to-shell`: navegação até inserir a estrutura autenticada
  no DOM; não equivale à métrica de pintura FCP.
- `finobra:navigation-to-route`: término da navegação inicial; não garante que
  todas as requisições assíncronas da tela ou a sincronização tenham terminado.

As métricas são locais e não enviam identificadores de usuários ou empresas.
Comparar primeiro acesso, cache quente e rede lenta em empresas pequenas e
grandes. A latência real de Neon/Vercel ainda precisa ser medida em produção.

## Continuidade do plano

Esta entrega cobre a tela inicial e parte da instrumentação e do carregamento
por demanda. Não conclui a evolução arquitetural inteira.

1. Medir APIs e sincronização com dados reais, sem coletar conteúdo sensível.
2. Migrar dependências restantes por domínio; muitos módulos atuais compartilham
   helpers de fornecedores, produtos e relatórios, exigindo extração prévia.
3. Implementar carga por tela, paginação por cursor e protocolo incremental com
   exclusões, idempotência e conflitos testados antes de substituir snapshots.
4. Revisar consultas/índices e integridade multiempresa; validar RLS e restauração
   em ambiente separado antes de alterar o banco principal.
5. Separar tarefas e WhatsApp, com fila persistente e propriedade de sessão.
6. Extrair regras do backend gradualmente, mantendo compatibilidade das APIs.
7. Evoluir cache versionado e IndexedDB com migração da fila offline.
8. Avaliar Redis, réplicas e escalabilidade somente com necessidade medida.

## Publicação e reversão

Respeitar a ordem do AGENTS.md: testes, commit, push e somente depois build de
distribuição/deploy. Publicar a API antes do frontend reduz a necessidade do
fallback; o cliente também funciona durante uma atualização desencontrada.

Em caso de regressão, reverter o commit e publicar novamente pela mesma ordem.
Esta etapa não contém migrações de banco ou alterações de infraestrutura.
