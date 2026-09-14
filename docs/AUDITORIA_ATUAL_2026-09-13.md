# Auditoria funcional da versão atual — FinObra

Revisão da pasta em 13/09/2026, commit `73f3c2575630`. Foram encontrados **13 problemas acionáveis**. As alterações do usuário foram preservadas; esta entrega é um levantamento, sem correções no código da aplicação ou publicação.

## Escopo e evidências

- Leitura dos módulos novos e suas integrações com eventos, persistência e backend.
- Navegação em 20 rotas principais com Edge/Chromium, em 1440 e 390 pixels, usando API isolada e dados sintéticos.
- Verificação das ações visíveis, abertura e criação de orçamento, editor SINAPI, aba de SLAs, portal e abas da obra.
- Provas controladas de preço oficial versus catálogo fixo, pesquisa sem resultados, BDI zero, argumentos de diálogos e callback de assinatura.
- Robô SINAPI executado em ambiente simulado, sem credenciais, rede ou banco de produção.
- `npm test`: passou. Sintaxe: **150 arquivos, zero erros**. Build Cloudflare: passou.

Esses resultados não significam que todos os fluxos funcionam. A suíte verifica principalmente estruturas e textos; por exemplo, o teste dos botões confere a presença do nome na lista de ações permitidas, mas não garante que o objeto e a função existam em execução. Erros capturados pelo próprio bridge aparecem no console e podem não chegar ao monitor global de erros.

Não foram executados pagamentos, envios de mensagens, assinaturas reais, alterações no Neon ou testes contra o backend publicado. A revisão de persistência abaixo se baseia nos caminhos de leitura e escrita presentes no código. Testes de tela foram feitos com viewports simulados, sem aparelho físico.

## Prioridade alta — P1

### A01 — Endpoint que dispara o robô SINAPI está sem autenticação

**Evidência:** [backend/server.js:52](D:/Projects/FINANÇAS/backend/server.js:52) monta o router sem middleware de autenticação. [backend/sinapi_robot.js:208](D:/Projects/FINANÇAS/backend/sinapi_robot.js:208) aceita `POST /api/sinapi/robot/run` diretamente. O `requireAuth` usado em outras rotas não é aplicado aqui.

**Reprodução isolada:** a chamada ao handler sem sessão ou cabeçalhos autenticados retornou `ok: true` e iniciou o trabalho. Não foi feita chamada à produção.

**Impacto:** se esse servidor estiver exposto com essa versão, um visitante pode disparar processamento e atualizações de metadados compartilhados. CORS não substitui autenticação.

**Correção:** proteger o disparo com autorização administrativa, validar competência e limitar reexecuções. Testar que chamadas anônimas sejam rejeitadas antes de iniciar qualquer trabalho.

### A02 — Robô anuncia importação concluída sem importar os itens

**Evidência:** [backend/sinapi_robot.js:142](D:/Projects/FINANÇAS/backend/sinapi_robot.js:142) atribui contagens fixas de 4.850 itens por série/UF. O loop grava apenas metadados em `bases_referenciais`; não baixa arquivos oficiais, não os interpreta e não insere itens em `itens_referenciais`.

**Reprodução:** sem banco configurado, terminou com `progressPct: 100`, `totalItemsIngested: 261900` e mensagem de sucesso para as 27 UFs. Essa quantidade resulta dos contadores fixos.

**Impacto:** o usuário acredita que tem bases atualizadas, mas a busca no banco pode continuar vazia. Falhas individuais de gravação também são apenas avisadas, sem necessariamente impedir o sucesso final.

**Correção:** contabilizar apenas dados realmente importados e validados, registrar falhas por UF/série e distinguir claramente simulação, execução parcial e conclusão real.

### A03 — Busca pode substituir o preço oficial por um preço fixo e ignora a seleção de bancos

**Evidência:** [js/orcamento_sinapi.js:1017](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:1017) pesquisa primeiro `BANCO_UNIFICADO_ITENS`, que contém valores fixos sem UF/competência. Em [linha 1030](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:1030), um resultado da base SINAPI é descartado se o código já estiver nessa lista. A seleção `bancos_config` não participa desse filtro.

**Reprodução controlada:** para o código `98458`, a base de teste retornou preço `999`, mas o resultado manteve `85,40`, vindo do catálogo fixo. O valor `999` é apenas uma sentinela de teste, não uma cotação oficial.

**Problema relacionado:** [js/orcamento_bancos.js:361](D:/Projects/FINANÇAS/js/orcamento_bancos.js:361) apenas reaplica BDI ao preço existente. Alterar UF, referência ou banco pode mostrar “Preços ... atualizados” sem consultar os novos preços.

**Impacto:** orçamentos e propostas podem usar preços que não correspondem ao contexto escolhido.

**Correção:** resolver cada item pela combinação banco, código, UF, referência e série; respeitar bancos desmarcados; priorizar a base efetivamente selecionada e informar ausência de preço em vez de substituí-lo silenciosamente.

### A04 — Portal pode exibir assinatura concluída sem persistir para a construtora

**Evidência:** [js/portal_cliente.js:820](D:/Projects/FINANÇAS/js/portal_cliente.js:820) altera primeiro o pacote em memória e depois tenta `DB.update` no armazenamento local. [js/data.js:256](D:/Projects/FINANÇAS/js/data.js:256) retorna `null` se o contrato não existir nesse armazenamento; o portal ignora o retorno e mostra sucesso.

**Reprodução do callback com dados sintéticos:** em um armazenamento sem contratos, o portal marcou `ass: true`, mas havia **zero contratos locais e zero chamadas de sincronização**. Nenhuma assinatura real foi realizada.

**Impacto:** no navegador do cliente externo, a confirmação visual pode não produzir qualquer registro acessível à empresa e desaparecer ao reabrir o link.

**Correção:** implementar gravação no servidor vinculada ao compartilhamento autorizado e ao documento; confirmar sucesso somente depois da persistência. Testar o fluxo em um navegador separado, sem sessão da construtora.

### A05 — SLAs da empresa e apontamentos da obra não têm persistência completa na API

**Evidência da empresa:** [js/cronograma_sla.js:164](D:/Projects/FINANÇAS/js/cronograma_sla.js:164) envia `{ slas_padrao }`, mas a API espera `data.preferences`. Além disso, [api/db.js:114](D:/Projects/FINANÇAS/api/db.js:114) não aceita `slas_padrao` no sanitizador, e o cliente não restaura esse campo em `_applyTenantPreferences`.

**Evidência da obra:** [js/cronograma_sla.js:217](D:/Projects/FINANÇAS/js/cronograma_sla.js:217) salva `processos_sla` e `data_previsao_termino`. Os caminhos de escrita de obras, incluindo [api/db.js:1378](D:/Projects/FINANÇAS/api/db.js:1378), não persistem esses campos; a data reconhecida é `data_previsao`.

**Impacto:** os ajustes podem funcionar no cache do navegador e não aparecer em outro aparelho ou após recuperação dos dados da nuvem. Corrigir apenas o botão não resolve esse problema.

**Correção:** alinhar esquema, payload, sanitização, leitura, escrita individual e sincronização em lote. Validar com salvar → leitura em sessão independente → comparação integral dos processos.

### A06 — Aba “SLAs & Prazos” chama uma interface que não existe

**Reprodução:** Configurações → SLAs & Prazos. O console registra `CronogramaSLA.getSlasPadrao is not a function`.

**Evidência:** [js/configuracoes.js:129](D:/Projects/FINANÇAS/js/configuracoes.js:129) chama `getSlasPadrao`; [linha 199](D:/Projects/FINANÇAS/js/configuracoes.js:199) chama `salvarSlasPadrao`. O módulo oferece `getSlasEmpresa` e `saveSlasEmpresa`. A tela também espera `diasSla`, `departamento` e `predecessor`, enquanto os registros usam `dias_sla`, `tipoLabel` e `predecessor_id`.

**Impacto:** a aba não renderiza corretamente; salvar continuaria quebrado mesmo se apenas o primeiro nome fosse ajustado.

**Correção:** adotar um contrato único entre configuração e motor, cobrindo renderização, edição, restauração e persistência.

### A07 — Botões e filtros de Pré-Compras ficam sem ação

**Reprodução:** Pré-Compras → Nova Pré-Compra; também os filtros e Limpar. O resolvedor retorna `ação indisponível`.

**Evidência:** `PreCompras` existe como `const` em [js/precompras.js:3](D:/Projects/FINANÇAS/js/precompras.js:3), mas está ausente de `ROOTS` em `patch26-events.js` e não está exposto em `window`. O resolvedor em [js/patch26-events.js:85](D:/Projects/FINANÇAS/js/patch26-events.js:85) procura nessa janela quando a raiz não está registrada.

**Impacto:** ações estão permitidas pela lista de segurança, mas não são encontradas. A checagem em tela identificou oito controles afetados no estado inicial; outros comandos do mesmo objeto compartilham a causa.

**Correção:** registrar explicitamente a raiz no bridge e testar criação, filtros e fluxo de aprovação com cliques reais.

### A08 — Importação SINAPI e ajuda apontam para funções ausentes

**Reprodução:** Orçamentos → abrir/criar orçamento → Importar Planilha. O botão não abre a importação e registra `ação indisponível`. A legenda do BDI registra `Utils.alert is not a function`.

**Evidência:** o botão em [js/orcamento_sinapi.js:582](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:582) chama `showImportModal`, que não existe no objeto atual. Ajuda e legenda, em [linha 1224](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:1224), usam `Utils.alert`, também ausente.

**Impacto:** importar a planilha oficial pelo editor não funciona, embora o carregamento do módulo em si funcione.

**Correção:** restaurar o fluxo completo de importação e conectar ajuda/legenda a um diálogo existente. Cobrir escolha de arquivo, processamento e pesquisa posterior dos itens importados.

### A09 — Diálogos do editor SINAPI recebem argumentos na ordem errada

**Evidência:** [js/utils.js:294](D:/Projects/FINANÇAS/js/utils.js:294) define `prompt(titulo, callback, valorInicial, placeholder)`. O SINAPI chama `prompt(titulo, valorInicial, callback)` em [linha 1175](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:1175), renomeação e edição de BDI, desconto e encargos.

**Reprodução:** Incluir Etapa abriu um campo preenchido com o código da função. Após digitar um nome e confirmar, o callback não executou e a etapa não foi adicionada.

**Impacto:** diversos botões abrem uma janela, mas confirmar não aplica a mudança. No caso de etapa, é preciso ainda implementar seleção/persistência real: o callback atual apenas muda o placeholder e mostra uma mensagem.

**Correção:** alinhar as chamadas à assinatura de `Utils.prompt` e testar o resultado persistido de cada operação, não apenas a abertura do diálogo.

### A10 — BDI igual a zero é substituído por 24,23%

**Reprodução:** editar o formulário de orçamento, informar BDI `0` e salvar. O registro resultante contém `24.23`.

**Evidência:** [js/orcamento_sinapi.js:1399](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:1399) usa `parseFloat(d.bdi) || this.BDI_PADRAO`, tratando zero como ausência. O preenchimento inicial também usa `orc.bdi || ...`.

**Impacto:** altera o percentual informado pelo usuário e pode elevar o valor do orçamento.

**Correção:** distinguir zero válido de vazio/NaN em preenchimento, edição e recálculo; incluir teste de ida e volta com zero.

## Prioridade média — P2

### A11 — Enter após pesquisa sem resultados insere um item da pesquisa anterior

**Reprodução:** pesquisar um código válido; trocar por uma palavra sem resultados; pressionar Enter. O teste passou de zero para um item, apesar da mensagem “Nenhum item encontrado”.

**Evidência:** os retornos antecipados em [js/orcamento_sinapi.js:1005](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:1005) não limpam `_lastSearchResults`; [linha 1097](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:1097) continua usando o resultado antigo.

**Correção:** invalidar o buffer quando a busca muda, fica curta ou não retorna nada. Enter deve operar apenas sobre um resultado atual e visível.

### A12 — Ferramentas anunciam execução, mas só exibem mensagens

**Evidência:** [js/orcamento_sinapi.js:1207](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:1207) contém `menuFerramentas`, `toggleAnalitico` e `filtroGrid`; [linha 1297](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:1297) contém `ajustarItens`. As funções apenas chamam `Utils.toast`, sem mudar estado, filtrar, abrir ferramentas ou ajustar itens.

**Impacto:** a interface confirma operações que não aconteceram.

**Correção:** implementar os comportamentos anunciados ou indicar indisponibilidade sem mensagem de ativação/sucesso.

### A13 — Abrir SINAPI cria automaticamente um orçamento de demonstração

**Reprodução:** iniciar o módulo com armazenamento vazio. Antes da criação manual, surge `orc-0001-default`, denominado “Conta de Energia Elétrica — Sede”.

**Evidência:** [js/orcamento_sinapi.js:84](D:/Projects/FINANÇAS/js/orcamento_sinapi.js:84) chama `_add` durante `render`, com proposta e data pré-preenchidas. `_add` também encaminha o registro à sincronização. A marca `finobra_sinapi_initialized` não é isolada por empresa.

**Impacto:** apenas visualizar o módulo altera dados de negócio e pode introduzir um orçamento que o usuário não cadastrou. Em uma instalação sem obra, a referência `padrao` também não corresponde necessariamente a uma obra válida.

**Correção:** remover a criação automática do fluxo normal. Demonstrações devem usar um ambiente ou modo explicitamente separado dos registros reais.

## Ordem sugerida de correção

1. Proteger o disparo do robô e eliminar confirmações de importação, preço e assinatura que não correspondem a persistência real.
2. Corrigir o contrato de SLAs de ponta a ponta e o registro de Pré-Compras no bridge.
3. Recuperar importação SINAPI, corrigir diálogos, preservar BDI zero e limpar resultados antigos da busca.
4. Implementar ou retirar ferramentas incompletas e eliminar a inserção automática de demonstração.
5. Acrescentar testes de fluxo para os erros acima: ações resolvíveis, cliques com resultado observável, dados preservados após nova sessão e rejeição de rotas administrativas anônimas.

## Arquivos de evidência local

- `scratch/audit-current-browser.cjs`, `scratch/audit-current-deep.cjs`, `scratch/audit-current-mobile.cjs`: roteiros de navegador com servidor isolado.
- `scratch/audit-current-browser.json`, `scratch/audit-current-probes.json`, `scratch/audit-current-mobile.json`: resultados.
- `scratch/audit-sinapi-robot.cjs` e `scratch/audit-sinapi-robot.json`: simulação do robô sem infraestrutura externa.
- `scratch/audit-current-tests.log`, `scratch/audit-current-syntax.log`, `scratch/audit-current-build.log`: verificações do projeto.

Nos cenários de tela executados não houve transbordamento horizontal da página. Isso não certifica todos os diálogos, estados preenchidos ou aparelhos. A falha `net::ERR_FAILED` dos logs corresponde ao bloqueio deliberado de recursos externos no ambiente isolado e não foi contabilizada como defeito do produto.
