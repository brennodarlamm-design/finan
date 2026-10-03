# Varredura do sistema — 03/10/2026

**Escopo:** financeiro, operações (medições, NF-e, compras, contratos), obras/portal/WhatsApp, sincronização de dados e performance/mobile. Segurança, SEO e SINAPI já tinham sido auditados (`docs/AUDITORIA_SEGURANCA_2026-10-02.md`, `docs/AUDITORIA_SEO_AEO_GEO_2026-10-03.md`, `docs/AUDITORIA_SINAPI_2026-10-03.md`).

**Método:**
- O código real foi executado em Node com dados de teste, nos casos em que dava para reproduzir.
- O navegador Chromium foi usado a 390px nas 32 rotas do app e nas páginas públicas.
- No banco de produção (Neon), só consultas de contagem e leitura do log de erros.

Legenda: **C** = confirmado (reproduzido ou evidente no código), **P** = provável.

## Prioridade 1 — perda de dados ou dinheiro errado

| # | Problema | Onde | |
|---|---|---|---|
| 1 | O `DB.init()` está definido duas vezes, e a versão completa nunca roda. O IndexedDB é gravado mas nunca lido de volta, não há sincronia entre abas, e o `purgeStorage()` roda em toda abertura (apaga o base64 de anexos ainda não migrados) | `js/data.js:241` e `:3267` | C |
| 2 | Duas abas abertas offline: uma sobrescreve a fila de envio e a coleção da outra, e o lançamento criado na primeira some | `js/data.js:394, 1588, 2016` | C |
| 3 | Sessão expirada ou logout apaga a fila offline sem avisar (o 401 ao reconectar limpa as chaves `finobra_*`). Os dados também continuam no IndexedDB depois do logout | `js/auth.js:599-633`, `js/data.js:1905` | C |
| 4 | Fora de lançamentos, o servidor grava "quem chegar por último vence": um celular offline sobrescreve edições mais novas e recria registros excluídos. O "Sincronizar tudo" envia o cache inteiro, que pode estar velho | `api/_db-mutations.js:329+`, `api/_db-sync.js` | C |
| 5 | "Restaurar backup" diz que deu certo, mas o próximo sync desfaz | `js/configuracoes.js:1344-1393` | C |
| 6 | Reimportar o mesmo OFX marca **outra** conta, de mesmo valor e vencimento próximo, como paga | `js/ofx.js:323-372, 693` | C |
| 7 | A baixa manual marca o lançamento como "conciliado". O débito do OFX fica sem par, e o caminho natural na tela cria a despesa em dobro | `js/lancamentos.js:811`, `js/escritorio.js:625` | C |
| 8 | Os imports OFX (histórico e vínculo transação↔lançamento) ficam só no navegador | `js/data.js:2017` | C |
| 9 | Eventos da SEFAZ (ciência, carta de correção, cancelamento) sobrescrevem a NF-e: o valor vai a 0 e o XML da nota se perde | `api/_sefaz-dfe.js:211, 503` | C |
| 10 | "Lançar" a NF-e ou ler pelo OCR duas vezes duplica a conta a pagar (não há checagem pela chave) | `js/nfe.js:1324`, `js/ocr.js:786` | C |
| 11 | NF-e com várias duplicatas vira um único título com o valor total, vencendo na 1ª data | `js/nfe.js:1185, 1366` | C |
| 12 | O backup diário no R2 lista as tabelas `clientes`/`contas`, que não existem, e o snapshot provavelmente aborta. Faltam notas, pré-compras e recibos. Nenhum restore é testado | `api/_edge-backup.js:8-25, 152` | P |

## Prioridade 2 — números errados na tela, em documentos ou para o cliente

| # | Problema | Onde | |
|---|---|---|---|
| 13 | O resumo das 08h no WhatsApp **nunca sai**: o comentário SQL com `${...}` vira um parâmetro, e o Postgres recusa a query | `backend/server.js:1063` | C |
| 14 | Telefone com DDD 55 (Santa Maria/RS) recebe mensagem no número errado: falta o código do país | `evolution_client.js:212`, `api/whatsapp.js:295` | C |
| 15 | O link do portal do cliente leva a obra inteira na URL (14 a 23 mil caracteres), com dados congelados e promessa de "tempo real" | `js/portal_cliente.js:65-181` | C (tamanho) / P (não abre) |
| 16 | A cobrança automática pula avisos quando o vencimento cai no fim de semana (o cron roda de segunda a sexta e compara o dia exato) | `backend/server.js:1335, 1512` | C |
| 17 | XML importado em Notas classifica compra como "Saída", e o valor a pagar desconta ICMS/IPI (NF de R$ 1.000 → R$ 770) | `js/notas.js:500-503`, `js/nfe_parser.js:68` | C |
| 18 | O contrato impresso traz valores de exemplo (entrada R$ 14.504,52 e parcela R$ 10.978,13) quando a entrada é 0 ou o campo não é editado | `js/contratos.js:672, 1042-1044` | C |
| 19 | "Em Atraso" some do A Pagar e do fluxo projetado, e o fluxo de 90 dias ignora o que já venceu | `js/data.js:2169`, `js/dashboard.js:805-848` | C |
| 20 | O total do Escritório soma receitas como despesas (R$ 300 + R$ 5.000 de receita = R$ 5.300 de "gasto") | `js/data.js:3218` | C |
| 21 | Atraso das etapas somado várias vezes (22 dias reais aparecem como +53d), e cada etapa ganha +1 dia | `js/cronograma_sla.js:304-360, 333` | C |
| 22 | Curva S: deslocada um mês para trás pelo fuso. Em "todas as obras", usa o maior % físico de uma só obra | `js/data.js:2403, 2531` | C |
| 23 | Medição editada não atualiza a receita, e a retenção técnica nunca volta como "a receber" | `js/medicoes.js:337-360, 223` | C |
| 24 | O robô do OFX concilia em lote com tolerância de R$ 10 e ±7 dias, sem olhar a conta, e "desconciliar" não desfaz a baixa | `js/ofx.js:10-12, 290, 901` | C |
| 25 | Recibo: número repetido após uma exclusão, e o valor por extenso sai errado ("um milhão reais", "um mil e um reais") | `js/recibos.js:81`, `js/utils.js:658` | C |
| 26 | Lançamento: a conta digitada à mão não aparece, e "nenhuma conta" mantém a anterior (há duas funções `_onContaChange`) | `js/lancamentos.js:593, 787` | C |
| 27 | Lançamento criado pela NF-e: sai sem conta, a nota fica "pago" em vez de "paga" e o fornecedor é duplicado | `js/nfe.js:1355-1395` | C |
| 28 | Histórico de preços: o OCR conta cada item duas vezes, e a média é calculada antes de salvar | `js/ocr.js:774-810`, `js/produtos.js:304` | C |
| 29 | Upload recusado pelo servidor (acima de 15 MB ou tipo bloqueado) aparece como "salvo" e fica só neste navegador | `js/documentos.js:447, 647` | C |
| 30 | Excluir uma pré-compra ou medição apaga o lançamento vinculado, mesmo já pago ou conciliado | `js/precompras.js:654`, `js/medicoes.js:362` | C |

## Prioridade 3 — funciona mal, mas sem dano direto

| # | Problema | Onde | |
|---|---|---|---|
| 31 | Arrastar arquivo **não funciona** em NF-e, OCR e Fases de documentos: `ondragover` inline é bloqueado pelo CSP (`script-src-attr 'none'`) | `js/nfe.js:471`, `js/ocr.js:100`, `js/fases_doc.js:397` | C |
| 32 | O app carrega 3,4 MB de JS logo de cara (808 KB gzip), dos quais cerca de 740 KB são de BIM que a maioria não usa | `app.html:19-107` | C |
| 33 | `sentry.js` (420 KB, com Replay) carregado sem `defer` na landing e no login | `landing.html:227`, `index.html:24` | C |
| 34 | O vídeo de 7,6 MB da landing toca automaticamente no celular | `marketing/main.jsx:320-354` | C |
| 35 | Cache: `/js` com `max-age=0` apesar do `?v=`, `/data/sinapi` sem cache longo, e o service worker faz network-first e acumula cerca de 3,4 MB por deploy | `cloudflare/_headers`, `sw.js:60-83` | C |
| 36 | Com a API fora do ar, o app mostra "Offline" e listas vazias ("0 cadastrados"), sem aviso de erro | `js/app.js:320` | C |
| 37 | Acessibilidade: 85% a 100% dos campos sem rótulo associado, 88 botões "✕" sem `aria-label` e alvos de toque abaixo de 32px | vários | C |
| 38 | `calculadora-bdi` e `/validar` estouram a largura em 390px | `calculadora-bdi.html:161, 551`, `validar.html:206` | C |
| 39 | Imagens: og:image de 690 KB, logo de 560 KB e PNGs órfãos de 1,9 MB | `img/` | C |
| 40 | Aba de e-mails das Notificações mostra 4 envios fictícios para todo tenant | `js/notificacoes.js:188-243` | C |
| 41 | Rota pública de boletim de medição com retenções erradas (IRRF no Simples, sem validar as alíquotas); a tela não a usa | `api/_v2-routes.js:339` | C |

## Produção (banco Neon, só leitura)

- **Documentos antigos:** 4 documentos ainda apontam para o armazenamento da Vercel, que o CSP bloqueia, então não abrem. Precisam ser migrados para o R2.
- **WhatsApp:** 3.287 linhas antigas de sessão em `tenant_whatsapp_auth`, de 1 tenant, sobra da integração anterior.
- **Log de erros:** o `client_error_logs` está cheio de relatórios "CSP mediu" (modo relatório), que escondem erros reais. Os bloqueios de `onclick` inline nas telas de lançamentos, orçamentos e pré-compras pararam depois de 24/09. Os erros de gráfico ("Canvas is already in use") são de 18 e 19/09, e o código atual já destrói o gráfico antes de recriar.

## Ordem de correção sugerida

1. **Dados (1–5, 12):** juntar os dois `DB.init`, travar a fila com `navigator.locks`, não apagar a fila no 401, checar versão em todas as tabelas, fazer o restore passar pelo servidor e corrigir as tabelas do backup.
2. **Financeiro e NF-e (6–11, 17, 19, 20, 24–28):** deduplicar o OFX por FITID e gravá-lo no servidor, fazer a baixa manual não marcar "conciliado", deduplicar a NF-e por chave, gerar uma parcela por duplicata e separar os eventos SEFAZ.
3. **Cliente e WhatsApp (13–16, 18):** correções de uma linha no cron e no telefone, contrato sem valores de exemplo e portal com token curto que busca os dados atuais.
4. **Obras (21–23, 29, 30):** SLA, Curva S, medições e upload.
5. **Rápidas de UX e performance (31–40):** arrastar arquivos, BIM sob demanda, `defer` no Sentry, vídeo, cache, acessibilidade e imagens.

## Correções aplicadas (03/10/2026)

**Rápidas**
- ✅ #13 Resumo das 08h no WhatsApp: a query volta a funcionar.
- ✅ #14 DDD 55: o código do país agora depende só de o número ter 10 ou 11 dígitos. Corrigido em 12 lugares (backend, admin, PIX, master e WhatsApp).
- ✅ #31 Arrastar arquivos em NF-e, OCR e Fases: o barramento de eventos trata o `dragover`. Testado no Chromium.
- ✅ #18 Contrato sem valores de exemplo; com entrada 0, a cláusula 08 sai com texto próprio; a área sai por extenso para qualquer valor.
- ✅ #25 (parte) Valor por extenso: "mil", "um milhão de reais" e o "e" entre grupos pela regra.

**Proteção de dados**
- ✅ #1 `DB.init` único: o IndexedDB é restaurado (o sync e o envio esperam), a sincronia entre abas está ativa e o `purgeStorage` só roda quando o espaço estoura.
- ✅ #2 Duas abas: o evento `storage` atualiza a memória da aba. Testado em Node e com duas abas reais no Chromium.
- ✅ #3 Sessão expirada preserva a fila offline. O logout pede confirmação quando há alterações pendentes e limpa o IndexedDB. Filas de outras empresas nunca são apagadas.
- ✅ #4 Versão por registro em todas as tabelas: edição velha recebe 409 e vai para "Revisar conflito", e registro excluído não volta. Vale também para o "Sincronizar tudo". Fases documentais ficam de fora.
- ✅ #5 "Restaurar backup" envia os registros pela fila.
- ✅ #6 O cursor do delta usa o relógio do servidor e o início do download, com 2 minutos de sobreposição.
- ✅ #12 Backup diário: corrigida a lista de tabelas, incluídas as que faltavam, e uma falha numa tabela não derruba as demais.

**Limitação conhecida (#4):** se a confirmação de uma gravação se perder na rede e o app reenviar, o reenvio vira conflito "sem divergência" para revisar. Em `lancamentos` isso não acontece, porque a query aceita conteúdo idêntico.

**Testes:** `scripts/test-varredura-2026-10-03.js`, incluído na suíte.

**OFX, NF-e e financeiro**
- ✅ #6 Reimportar o mesmo OFX: as transações já importadas da mesma conta (FITID) são ignoradas; se o arquivo inteiro já existir, ele é bloqueado.
- ✅ #7 A baixa manual não marca mais "conciliado".
- ✅ #9 Eventos da SEFAZ não sobrescrevem mais a NF-e, e o cancelamento atualiza a situação.
- ✅ #10 NF-e e OCR: sem clique duplo e sem relançar uma chave já lançada.
- ✅ #11 Uma conta a pagar por duplicata.
- ✅ #17 Notas por XML: entrada/saída decidida pelo CNPJ da construtora, e o valor a pagar é o vNF menos as retenções.
- ✅ #19 "Em atraso" entra nos totais, no filtro e na projeção de 90 dias.
- ✅ #20 O total do Escritório não soma mais receitas.
- ✅ #24 Em lote só entra conciliação com valor exato, confiança de 70% ou mais e da mesma conta; desconciliar desfaz a baixa.
- ✅ #25 Recibos: número sem repetição. (O valor por extenso foi corrigido na etapa de correções rápidas.)
- ✅ #26 Conta digitada à mão no lançamento.
- ✅ #27 Lançamento gerado pela NF-e: conta pelo apelido, status "paga" e fornecedor pelo CNPJ.
- ✅ #28 Histórico de preços sem contar a mesma compra duas vezes, e a média é calculada depois de gravar.
- ⏳ #8 Imports de OFX gravados no servidor: falta. Exige uma tabela nova. Hoje a proteção contra reimportação vale por aparelho.

**Cliente e portal**
- ✅ #15 O link do portal agora tem cerca de 120 caracteres e leva só empresa, obra, validade e assinatura (v2). O portal busca os dados atuais no servidor (`POST /api/v2/portal/data`) e não inclui arquivos do armazenamento privado. Links antigos continuam abrindo. A mensagem do WhatsApp não promete mais "tempo real" nem assinatura de documentos. O aviso interno de versão não aparece mais para o cliente.
- ✅ #16 Cobrança: os estágios passaram a ser faixas de dias (`backend/billing_stages.js`), com envio único por ciclo de vencimento. Nenhum aviso some quando o vencimento cai no fim de semana; isso foi verificado numa simulação com vencimento em cada dia da semana.

**Próximos passos:** obras (#21–#23, #29, #30) e UX/performance (#32–#40).
