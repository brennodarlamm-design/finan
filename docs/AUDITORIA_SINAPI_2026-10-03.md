# Auditoria do módulo SINAPI — 03/10/2026

**Pergunta:** o módulo SINAPI funciona de verdade para fazer orçamento?

**Resposta curta:** funciona só em parte. Os preços que o sistema traz são reais e as contas do orçamento estão certas. Mas a base só existe para **3 estados (SP, SC e RR), competência 08/2026**. Há também defeitos que, no uso normal, impedem achar itens ou somem com parte da tabela. Do jeito que está, o módulo não entrega o que o site promete ("SINAPI dos 27 estados").

## Método

- Leitura do código: `js/sinapi.js`, `js/orcamento_sinapi.js`, `js/orcamento_bancos.js`, `js/orcamento_proposta.js`, `api/_sinapi-reference.js`, `api/_db-queries.js`, `api/_v2-routes.js` e `backend/sinapi_robot.js`.
- Execução do código real do `js/sinapi.js` em Node, simulando o navegador com `localStorage` limitado a 5 MB.
- Conferência dos 8 arquivos de base em `data/`.
- Consulta somente leitura ao banco de produção (Neon), apenas contagens.

## O que está funcionando

| Item | Situação |
|---|---|
| Dados da Caixa empacotados | 🟢 SP, SC e RR 08/2026, onerado e desonerado: 10.547 composições e 4.876 insumos cada. Sem códigos duplicados. Preços conferem com a tabela (ex.: 88309 pedreiro com encargos R$ 37,26 onerado e R$ 35,18 desonerado em SP) |
| Diferença entre onerado e desonerado | 🟢 Coerente: 7.744 itens com mão de obra mudam de preço e 7.679 sem mão de obra ficam iguais |
| Cálculo do orçamento | 🟢 Preço com BDI arredondado por item, depois × quantidade. É o padrão das planilhas de licitação. Tela, Excel e proposta usam a mesma função (`calcularTotais`) |
| Busca | 🟢 Por código ou palavras, sem acento, composições e insumos |
| Troca de período pelo modal "Períodos utilizados" | 🟢 Atualiza os preços pela base escolhida e marca como pendente o que não acha, sem apagar o valor anterior |
| Importação da planilha oficial da Caixa (ZIP/XLSX) | 🟡 O código lê as abas oficiais (CSD/CCD/ISD/ICD) por UF. Não foi possível testar com o arquivo real neste ambiente |
| Teste `scripts/test-sinapi-official.js` | 🟢 Passa, mas não cobre os defeitos abaixo |

## Problemas encontrados

### 🔴 1. Orçamento novo não encontra nenhum item e a tela fica carregando sem parar
- O formulário de orçamento novo vem com a competência **2026-07** (`orcamento_sinapi.js`, `showForm`), mas só existe base **2026-08**.
- `ensureBaseLoaded` não acha 2026-07 e carrega a base de **SP 2026-08** no lugar. Ela é gravada como SP/2026-08, e o orçamento continua pedindo 2026-07, então a busca segue vazia.
- Na busca rápida (`_onQuickSearchInput`), quando a base "carrega", a busca roda de novo. Continua vazia, e ele tenta carregar de novo, **em ciclo**. Cada volta baixa e grava cerca de 3 MB enquanto o texto estiver no campo. Isso trava o navegador, sobretudo no celular.
- Acontece também em **qualquer obra fora de SP, SC e RR**, porque a UF padrão vem do endereço da obra.
- Simulação com o código real: depois de `ensureBaseLoaded(SP, 2026-07)`, `hasBase` = falso e a busca por "chapisco" retorna 0 itens.

### 🔴 2. Depois de recarregar a página, a tabela desonerada fica com só 5.000 dos 15.423 itens
- Cada base ocupa cerca de 3,2 MB no `localStorage`, que tem limite de cerca de 5 MB por site. Esse limite é dividido com o resto do sistema.
- Quando não cabe, `_saveBase` grava só os **5.000 primeiros itens** e marca `parcial`. Na próxima abertura do sistema, `hasBase` vê a base parcial como existente e **nunca baixa a completa de novo**.
- Simulação: carregando onerado e desonerado de SP, a desonerada volta com 5.000 itens. A busca por **88309** (pedreiro com encargos) não acha nada, e "concreto fck = 25" acha 4 em vez de 14.
- O usuário não recebe aviso. Para ele, parece que o item não existe no SINAPI.

### 🔴 3. Só 3 estados, e o site promete 27
- Bases disponíveis: SP, SC e RR (08/2026) e RR (12/2024, antiga e sem o tipo COMP/INSUMO).
- Site, planos, `llms.txt` e o painel de planos (`webmcp.js`) dizem "SINAPI dos 27 estados".
- O caminho pelo servidor (robô `backend/sinapi_robot.js`, tabela `itens_referenciais` e rotas `/api/v2/engineering/sinapi`) está **vazio em produção**: 0 itens e 0 bases. Além disso, a tela de orçamento **não usa** essas rotas, só os arquivos de `data/`.
- O robô depende de alguém colocar o ZIP da Caixa no servidor e disparar a carga à mão. Não há agendamento.
- Para outros estados, o único caminho é cada usuário importar o ZIP da Caixa no próprio navegador. A base fica só naquele navegador, sem passar para colegas ou para o celular, e sofre com o limite do problema 2.

### 🟠 4. Mudar UF, competência ou regime no cadastro do orçamento não atualiza os preços
- `save()` recalcula apenas o BDI. Se o usuário troca de RR para SP, ou de onerado para desonerado, pelo formulário, o cabeçalho passa a mostrar a nova base, mas **os preços continuam os da base antiga**.
- Só o modal "Períodos utilizados" reprecifica.

### 🟠 5. Itens com preço zero entram no orçamento sem aviso
- Muitas composições não têm preço em alguns estados: 2.144 em SP, 2.885 em SC e 4.228 em RR (por exemplo, alvenaria estrutural nova, AF_07/2026). Elas aparecem e entram no orçamento por **R$ 0,00**, sem alerta, o que reduz o valor total.

### 🟠 6. Atalho que troca para Roraima 2024 sem querer
- Na importação, o botão "1-clique", quando não há base para a UF/competência escolhida, **troca para RR 12/2024**: base antiga, de outro estado e com preços de quase 2 anos atrás.

### 🟠 7. Funções que aparecem, mas não existem
- "Períodos utilizados" lista 23 outros bancos (SICRO, ORSE, SEINFRA, SUDECAP...), vários já **marcados como em uso**, mas nenhum tem preços. O aviso no modal admite isso; ainda assim, o resumo no topo do orçamento mostra "+ SICRO...".
- O padrão do banco SINAPI nesse modal é **AC 7/2026**, base que não existe.
- **BDI diferenciado** para materiais é anunciado no plano Ilimitado, mas não existe no orçamento SINAPI: há um único BDI para todos os itens.
- "Encargos sociais" é um campo de texto livre que não entra em nenhum cálculo. "Exibir analítico" e "Desconto" estão desativados.
- Não há composição analítica (insumos e coeficientes de cada composição): só o preço final de cada item.

### 🟡 8. Menores
- Excel: a coluna "Total" de cada item é sem BDI e sem arredondamento, e o subtotal é arredondado por item. Não traz o preço unitário com BDI nem o regime (onerado/desonerado). Planilhas de licitação normalmente pedem as duas colunas.
- A base mais nova é 08/2026. Em outubro, convém conferir se a Caixa já publicou 09/2026.
- Cada empresa guarda a própria cópia da base no navegador (a chave inclui o tenant), o que piora o problema 2 quando se usa mais de uma conta.

## Conclusão prática

| Cenário | Funciona? |
|---|---|
| Obra em SP, SC ou RR, competência 08/2026, só um regime aberto | 🟢 Sim, com preços corretos |
| Orçamento novo com a competência padrão (07/2026) | 🔴 Não acha itens e entra em ciclo de carregamento |
| Obra em qualquer outro estado | 🔴 Não, a não ser importando o ZIP da Caixa no navegador, com as limitações acima |
| Usar onerado e desonerado no mesmo navegador e recarregar | 🔴 Perde cerca de 2/3 da tabela, sem aviso |
| Trocar a base pelo formulário do orçamento | 🟠 Preços ficam desatualizados |

## Correções recomendadas (ordem)

1. **Competência padrão = a mais recente disponível** e nada de "trocar base por outra": se não houver base para a UF/competência, mostrar uma mensagem clara e parar o ciclo de carregamento.
2. **Guardar a base no IndexedDB** (centenas de MB), e não no `localStorage`. Também não aceitar como completa uma base `parcial`.
3. **Base no servidor para os 27 estados:** carregar o ZIP oficial da Caixa no Neon com o robô e fazer a tela buscar pela API (`/api/v2/engineering/sinapi`), por UF e competência, sob demanda. Isso resolve os 27 estados, o limite do navegador e o compartilhamento entre usuários e celular. A carga mensal pode ser automatizada.
4. **Reprecificar ao salvar o formulário** quando mudar UF, competência ou regime, com o mesmo aviso de itens pendentes.
5. **Bloquear ou alertar itens com preço zero.**
6. **Ajustar a comunicação** enquanto os 27 estados não estiverem prontos: tirar "27 estados" e "BDI diferenciado" do site e dos planos, e esconder os bancos sem dados.
7. Excel com preço unitário com BDI, regime e total por item coerente com o subtotal.
8. Testes automáticos para os casos 1, 2 e 4.
