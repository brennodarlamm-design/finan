from pathlib import Path
import re
import json

# 1) Remove Diagnóstico da tela do cliente. A coleta técnica continua e o Master/DEV já exibe saúde global.
path = Path('js/configuracoes.js')
text = path.read_text()
text = text.replace("  _errorsCache: [],\n  _errorsOffset: 0,\n  _errorsHasMore: false,\n", "")
text = text.replace("if (!isAdmin && ['usuarios','auditoria','diagnostico'].includes(this._activeTab))", "if (!isAdmin && ['usuarios','auditoria'].includes(this._activeTab))")
diag_button = '''        ${isAdmin ? `<button id="cfg-tab-diagnostico" class="cfg-tab${this._activeTab==='diagnostico'?' cfg-tab-active':''}" data-fb-click="Configuracoes._switch" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="diagnostico">\n          &#x1F6E0;&#xFE0F; Diagn&oacute;stico\n        </button>` : ''}\n'''
if diag_button not in text:
    raise SystemExit('Botão Diagnóstico do cliente não encontrado.')
text = text.replace(diag_button, '', 1)
text = text.replace("...(isAdmin ? ['usuarios','auditoria','diagnostico'] : [])", "...(isAdmin ? ['usuarios','auditoria'] : [])")
text = text.replace("    if (tab === 'diagnostico') this.loadErrors(true);\n", "")
text = text.replace("    if (tab === 'diagnostico') return this._renderDiagnostico();\n", "")
text, n = re.subn(r"\n  // ── DIAGNÓSTICO DE ERROS ─+\n.*?\n  // ── AUDITORIA ─+", "\n\n  // ── AUDITORIA ───────────────────────────────────────────", text, count=1, flags=re.S)
if n != 1:
    raise SystemExit('Bloco de diagnóstico do cliente não foi removido de forma única.')
path.write_text(text)

# 2) OCR: fluxo Gemini-only anterior à integração OpenAI, preservando hardening do Patch 35.
path = Path('api/reconhecer-documento.js')
text = path.read_text()
old = """  const openaiApiKey = String(process.env.OPENAI_API_KEY || '').trim();
  const geminiApiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!openaiApiKey && !geminiApiKey) {
    return res.status(500).json({ error: 'Nenhuma chave de IA (OPENAI_API_KEY ou GEMINI_API_KEY) configurada no servidor.' });
  }"""
new = """  const geminiApiKey = String(process.env.GEMINI_API_KEY || '').trim();

  if (!geminiApiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
  }"""
if text.count(old) != 1:
    raise SystemExit('Bloco de chaves OCR atual não encontrado.')
text = text.replace(old, new, 1)

start = text.find('    let ocrResult = null;')
end = text.find('    normalizarDadosOCR(ocrResult);', start)
if start < 0 or end < 0:
    raise SystemExit('Bloco de provedores OCR não encontrado.')
gemini_only = '''    let ocrResult = null;
    let modeloUsado = null;
    let lastError = null;

    // Fluxo sem OpenAI: restaura a família Gemini usada antes da integração ChatGPT.
    const models = [
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest'
    ];

    const geminiPayload = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: cleanMime, data: cleanBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      }
    };

    for (const model of models) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(20000),
          body: JSON.stringify(geminiPayload)
        });

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const parts = geminiData?.candidates?.[0]?.content?.parts || [];
          let rawText = '';
          for (const part of parts) {
            if (part.text) rawText += part.text;
          }
          rawText = rawText.trim();
          if (rawText) {
            ocrResult = repairJson(rawText);
            modeloUsado = model;
            break;
          }
        } else {
          const errTxt = await geminiRes.text();
          lastError = `[${model}] HTTP ${geminiRes.status}: ${errTxt.slice(0, 150)}`;
          console.warn('[OCR] Tentativa Gemini falhou:', model, geminiRes.status);
        }
      } catch (errNetGemini) {
        lastError = `[${model}] ${errNetGemini.message}`;
        console.warn('[OCR] Tentativa Gemini falhou:', model, errNetGemini.message);
      }
    }

    if (!ocrResult) {
      console.error('[OCR] Todos os modelos Gemini falharam:', lastError);
      return res.status(502).json({
        error: 'O reconhecimento de documentos está temporariamente indisponível. Tente novamente.'
      });
    }

'''
text = text[:start] + gemini_only + text[end:]
text = text.replace("      provedor: provedorUsado,", "      provedor: 'gemini',")
if 'OPENAI_API_KEY' in text or 'api.openai.com' in text or 'gpt-4o-mini' in text:
    raise SystemExit('Referência OpenAI permaneceu no OCR.')
path.write_text(text)

# 3) Frontend OCR: remover referências visuais ao ChatGPT/OpenAI.
path = Path('js/ocr.js')
text = path.read_text()
text = text.replace('IA Vision (ChatGPT & Gemini) · Boleto · NF-e · NFC-e · NFS-e · Contas', 'IA Vision Gemini · Boleto · NF-e · NFC-e · NFS-e · Contas')
old_badge = '''${provedor === 'openai' ? '<span style="background:rgba(16,185,129,.15);color:#10b981;font-size:.68rem;padding:2px 6px;border-radius:4px;font-weight:800;border:1px solid rgba(16,185,129,.3);">🤖 ChatGPT Vision</span>' : provedor === 'gemini' ? '<span style="background:rgba(99,102,241,.15);color:#818cf8;font-size:.68rem;padding:2px 6px;border-radius:4px;font-weight:800;border:1px solid rgba(99,102,241,.3);">✨ Gemini Vision</span>' : ''}'''
new_badge = '''${provedor === 'gemini' ? '<span style="background:rgba(99,102,241,.15);color:#818cf8;font-size:.68rem;padding:2px 6px;border-radius:4px;font-weight:800;border:1px solid rgba(99,102,241,.3);">✨ Gemini Vision</span>' : ''}'''
if old_badge not in text:
    raise SystemExit('Badge ChatGPT/Gemini não encontrado no frontend OCR.')
text = text.replace(old_badge, new_badge, 1)
path.write_text(text)

# 4) FinBot: conhecimento maior + memória aprendida só de respostas humanas do MESMO tenant.
path = Path('api/users.js')
text = path.read_text()
kb_start = text.find('const SUPPORT_KB = Object.freeze([')
kb_end = text.find('\n]);\n\nfunction supportBotReply', kb_start)
if kb_start < 0 or kb_end < 0:
    raise SystemExit('SUPPORT_KB não encontrada.')
kb = r'''const SUPPORT_KB = Object.freeze([
  { topic:'notas', patterns:[/nota fiscal/i,/\bnf-?e\b/i,/\bnfce\b/i,/\bnfse\b/i,/\bxml\b/i,/\bocr\b/i,/danfe/i], answer:'Em Notas Fiscais você pode consultar e organizar NF-e/NFC-e/NFS-e, XML e DANFE. O reconhecimento de documentos usa Gemini Vision para ler PDF ou imagem e sugerir fornecedor, valores e itens quando o documento for uma nota fiscal.' },
  { topic:'medicoes', patterns:[/mediç/i,/medicao/i,/medição/i,/boletim/i,/caixa econômica/i,/caixa economica/i], answer:'No módulo Medições você registra avanço físico, percentuais e valores medidos da obra. O FinObra mantém acumulados e permite preparar boletins para acompanhamento e financiamento.' },
  { topic:'ofx', patterns:[/\bofx\b/i,/concilia/i,/extrato banc/i], answer:'Na Conciliação OFX, importe o arquivo .OFX do banco. O FinObra cruza as transações com os lançamentos e sugere correspondências para conferência antes da baixa.' },
  { topic:'obras', patterns:[/\bobra\b/i,/cliente/i,/nova obra/i,/contrato caixa/i], answer:'Para cadastrar uma obra, entre em Obras & Clientes e escolha Nova Obra. Informe cliente, datas, valor/contrato e os demais dados. Os limites de obras ativas dependem do plano contratado.' },
  { topic:'fornecedores', patterns:[/fornecedor/i,/cnpj/i], answer:'Fornecedores são cadastrados no módulo Fornecedores com CNPJ/CPF, razão social, contato, endereço, município e UF. Depois ficam disponíveis nos lançamentos, notas e compras.' },
  { topic:'financeiro', patterns:[/lançamento/i,/lancamento/i,/receita/i,/despesa/i,/contas? a pagar/i,/contas? a receber/i,/fluxo de caixa/i], answer:'No Financeiro, use Novo Lançamento para registrar receita ou despesa, vencimento, fornecedor, obra/centro de custo, conta e status. O sistema também consolida fluxo de caixa e realizado por obra.' },
  { topic:'orcamentos', patterns:[/orçamento/i,/orcamento/i,/planilha orçament/i,/insumo/i,/composição/i,/composicao/i], answer:'Em Orçamentos você monta a planilha da obra com categorias, itens, quantidades e preços. O FinObra calcula totais e permite comparar o orçamento com o realizado.' },
  { topic:'sinapi', patterns:[/sinapi/i,/caixa.*insumo/i,/referência sinapi/i,/referencia sinapi/i], answer:'O orçamento SINAPI trabalha com UF, competência/referência e dados oficiais disponíveis para a seleção. O FinObra mantém o orçamento separado por obra e permite aplicar BDI e Leis Sociais.' },
  { topic:'engenharia', patterns:[/curva s/i,/\bevm\b/i,/\bcpi\b/i,/\bspi\b/i,/\beac\b/i,/curva abc/i,/pareto/i,/\bbdi\b/i,/cronograma físico/i,/cronograma fisico/i], answer:'No Hub da Obra ficam os controles de engenharia: Cronograma Físico-Financeiro, Curva S, EVM (BAC/PV/EV/AC/CPI/SPI/EAC/VAC), Curva ABC e BDI. As configurações podem ser ajustadas por obra e exportadas em relatórios.' },
  { topic:'precompras', patterns:[/pré-compra/i,/pre-compra/i,/pre compra/i,/ordem de compra/i,/solicitação de compra/i,/solicitacao de compra/i], answer:'Pré-Compras organiza solicitações e ordens de compra do canteiro, com itens, fornecedor e fluxo de aprovação antes da compra definitiva.' },
  { topic:'relatorios', patterns:[/relatório/i,/relatorio/i,/exportar/i,/excel/i,/xlsx/i,/pdf/i,/dossiê/i,/dossie/i], answer:'O FinObra possui exportações de engenharia e relatórios em Excel/PDF. No Hub da Obra você pode exportar cronograma, Curva ABC, Orçado x Realizado, BDI ou o dossiê completo.' },
  { topic:'contratos', patterns:[/contrato/i,/recibo/i], answer:'Contratos e Recibos ficam salvos na nuvem da empresa. Você pode criar, editar, imprimir e, nos planos compatíveis, usar assinatura eletrônica e QR de validação.' },
  { topic:'assinatura', patterns:[/assinatura/i,/qr code/i,/validar/i,/validação/i,/validacao/i], answer:'A assinatura eletrônica gera um código de validação registrado no servidor. O QR Code leva à página pública de validação, que consulta o registro real no FinObra.' },
  { topic:'usuarios', patterns:[/usuário/i,/usuario/i,/perfil/i,/permiss/i,/acesso/i], answer:'Em Configurações > Usuários, o administrador pode criar usuários, escolher perfis e restringir módulos. As permissões específicas reduzem acesso; não elevam o poder do perfil.' },
  { topic:'planos', patterns:[/plano/i,/cobrança/i,/cobranca/i,/\bpix\b/i,/mensalidade/i,/pagamento/i], answer:'Abra Planos & Cobrança para consultar plano, limites e mensalidade. Cobranças PIX pendentes aparecem com valor, identificação e histórico.' },
  { topic:'whatsapp', patterns:[/whatsapp/i,/mensagem/i,/qr.*whatsapp/i], answer:'O WhatsApp usa uma sessão própria da empresa no servidor. Quando necessário, conecte pelo QR Code e confira o status da sessão antes de enviar mensagens.' },
  { topic:'sessoes', patterns:[/sessão/i,/sessao/i,/dispositivo/i,/celular conectado/i,/computador conectado/i], answer:'Em Configurações > Sessões você pode ver os dispositivos conectados à sua conta e encerrar acessos que não reconhece.' },
  { topic:'erro', patterns:[/erro/i,/bug/i,/não funciona/i,/nao funciona/i,/travou/i,/problema/i], answer:'Informe em qual tela aconteceu, o que você estava fazendo e qual mensagem apareceu. O diagnóstico técnico fica com a equipe DEV/Suporte e não é exibido na tela do cliente. Se precisar, clique em “Chamar atendente”.' }
]);'''
text = text[:kb_start] + kb + text[kb_end + len('\n]);'):]

ai_start = text.find('async function getOpenAIBotReply(text) {')
ai_end = text.find('\nfunction getSupportRenderBaseUrl()', ai_start)
if ai_start < 0 or ai_end < 0:
    raise SystemExit('Função OpenAI do FinBot não encontrada.')
learning = r'''const SUPPORT_STOP_WORDS = new Set(['a','o','as','os','de','da','do','das','dos','e','em','no','na','nos','nas','um','uma','uns','umas','para','por','com','sem','que','como','eu','me','meu','minha','meus','minhas','voce','voces','isso','isto','essa','esse','ao','aos']);

function supportTokens(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(x => x.trim())
    .filter(x => x.length > 1 && !SUPPORT_STOP_WORDS.has(x));
}

function supportSimilarity(a, b) {
  const aa = new Set(supportTokens(a));
  const bb = new Set(supportTokens(b));
  if (aa.size < 2 || bb.size < 2) return 0;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection++;
  const union = new Set([...aa, ...bb]).size || 1;
  return intersection / union;
}

async function findLearnedSupportAnswer(sql, tenantId, text) {
  if (supportTokens(text).length < 2) return null;
  // Aprendizado seguro: somente respostas HUMANAS anteriores do mesmo tenant.
  // Evita auto-reforço de uma resposta automática errada e impede vazamento entre empresas.
  const rows = await sql`
    SELECT q.body AS question, a.body AS answer
    FROM support_messages q
    JOIN LATERAL (
      SELECT body, created_at, id
      FROM support_messages a
      WHERE a.conversation_id=q.conversation_id
        AND a.tenant_id=q.tenant_id
        AND a.sender_type='agent'
        AND (a.created_at > q.created_at OR (a.created_at=q.created_at AND a.id>q.id))
      ORDER BY a.created_at ASC, a.id ASC
      LIMIT 1
    ) a ON TRUE
    WHERE q.tenant_id=${tenantId} AND q.sender_type='client'
    ORDER BY q.created_at DESC, q.id DESC
    LIMIT 250;
  `;

  let best = null;
  for (const row of rows) {
    const score = supportSimilarity(text, row.question);
    if (score >= 0.62 && (!best || score > best.score)) {
      best = { score, answer: cleanSupportText(row.answer, 4000) };
    }
  }
  return best?.answer || null;
}
'''
text = text[:ai_start] + learning + text[ai_end:]

old_flow = '''          let reply = null;
          try {
            reply = await getOpenAIBotReply(text);
          } catch (eBot) {
            console.warn('[FinBot] Erro ao consultar ChatGPT:', eBot.message);
          }
          if (!reply) {
            reply = supportBotReply(text);
          }'''
new_flow = '''          let reply = null;
          try {
            reply = await findLearnedSupportAnswer(sql, auth.tenantId, text);
          } catch (eLearn) {
            console.warn('[FinBot] Falha ao consultar memória aprendida:', eLearn?.message || eLearn);
          }
          if (!reply) {
            reply = supportBotReply(text);
          }'''
if text.count(old_flow) != 1:
    raise SystemExit('Fluxo OpenAI do FinBot não encontrado de forma única.')
text = text.replace(old_flow, new_flow, 1)
if 'getOpenAIBotReply' in text or 'api.openai.com' in text or 'OPENAI_API_KEY' in text:
    raise SystemExit('Referência OpenAI permaneceu no FinBot.')
path.write_text(text)

# 5) Atualizar testes antigos para refletir UX DEV-only e IA sem OpenAI.
path = Path('scripts/test-patch08-static.js')
text = path.read_text()
old_test = "test('Admin vê diagnóstico do próprio tenant', /_renderDiagnostico/i.test(cfg) && /action=errors/i.test(cfg));"
new_test = "test('Diagnóstico técnico não aparece na tela do cliente e permanece no DEV', !/_renderDiagnostico/i.test(cfg) && !/cfg-tab-diagnostico/i.test(cfg) && /carregarErrosSaaS/i.test(master) && /client_errors/i.test(master));"
if old_test not in text:
    raise SystemExit('Teste antigo de diagnóstico não encontrado.')
path.write_text(text.replace(old_test, new_test, 1))

path = Path('scripts/test-patch35-static.js')
text = path.read_text()
old_checks = """assert(ocrApi.includes('AbortSignal.timeout(35000)'), 'OCR OpenAI possui timeout abaixo do limite da função.');
assert(ocrApi.includes('AbortSignal.timeout(20000)'), 'Fallback Gemini possui timeout por tentativa.');
assert(!ocrApi.includes('detalhe: erroConsolidado'), 'OCR não devolve erro consolidado bruto dos provedores.');
assert(!ocrApi.includes('detalhe: err.message'), 'OCR não devolve exceção interna inesperada.');
assert(ocrApi.includes('/credit_balance_exhausted|insufficient_quota/i'), 'OCR mantém detecção interna de limite de uso para mensagem amigável.');
assert(usersApi.includes('AbortSignal.timeout(15000)'), 'FinBot ChatGPT possui timeout explícito e fallback local.');"""
new_checks = """assert(!ocrApi.includes('OPENAI_API_KEY') && !ocrApi.includes('api.openai.com') && !ocrApi.includes('gpt-4o-mini'), 'OCR não usa OpenAI nem gera custo por chamada OpenAI.');
assert(ocrApi.includes('GEMINI_API_KEY') && ocrApi.includes('gemini-3.6-flash') && ocrApi.includes('gemini-3.5-flash'), 'OCR voltou ao fluxo Gemini-only anterior.');
assert(ocrApi.includes('AbortSignal.timeout(20000)'), 'Gemini OCR possui timeout por tentativa.');
assert(!ocrApi.includes('detalhe: err.message'), 'OCR não devolve exceção interna inesperada.');
assert(!usersApi.includes('OPENAI_API_KEY') && !usersApi.includes('api.openai.com') && !usersApi.includes('getOpenAIBotReply'), 'FinBot não depende da OpenAI.');
assert(usersApi.includes('findLearnedSupportAnswer') && usersApi.includes("a.sender_type='agent'") && usersApi.includes('q.tenant_id=${tenantId}'), 'FinBot aprende apenas com respostas humanas anteriores do mesmo tenant.');
assert(usersApi.includes('supportSimilarity') && usersApi.includes('score >= 0.62'), 'FinBot usa similaridade conservadora para reaproveitar conhecimento aprendido.');"""
if old_checks not in text:
    raise SystemExit('Bloco de testes OCR/FinBot do Patch35 não encontrado.')
text = text.replace(old_checks, new_checks, 1).replace('Patch 35 blocos 1–5:', 'Patch 35 blocos 1–7:')
path.write_text(text)

# 6) Substituir suíte OpenAI por suíte de controle de custo/FinBot aprendido.
old = Path('scripts/test-openai-static.js')
if not old.exists():
    raise SystemExit('test-openai-static.js não encontrado.')
old.unlink()
newtest = Path('scripts/test-finbot-learning-static.js')
newtest.write_text(r'''import fs from 'fs';

let fails = 0;
function read(p){ return fs.readFileSync(p, 'utf8'); }
function ok(name, cond){ if (cond) console.log(`  ✓ ${name}`); else { console.error(`  ✗ ${name}`); fails++; } }

console.log('=== FinBot aprendizado + OCR Gemini-only ===\n');
const ocrApi = read('./api/reconhecer-documento.js');
const usersApi = read('./api/users.js');
const ocrJs = read('./js/ocr.js');
const cfg = read('./js/configuracoes.js');
const master = read('./js/master.js');

ok('OCR não contém OpenAI', !/OPENAI_API_KEY|api\.openai\.com|gpt-4o-mini|ChatGPT Vision/.test(ocrApi));
ok('OCR usa somente Gemini configurado no servidor', /GEMINI_API_KEY/.test(ocrApi) && /gemini-3\.6-flash/.test(ocrApi) && /gemini-3\.5-flash/.test(ocrApi));
ok('Frontend OCR identifica apenas Gemini Vision', /IA Vision Gemini/.test(ocrJs) && !/ChatGPT & Gemini|ChatGPT Vision/.test(ocrJs));
ok('FinBot não depende de OpenAI', !/OPENAI_API_KEY|api\.openai\.com|getOpenAIBotReply/.test(usersApi));
ok('FinBot possui conhecimento ampliado do FinObra', /topic:'orcamentos'/.test(usersApi) && /topic:'sinapi'/.test(usersApi) && /topic:'engenharia'/.test(usersApi) && /topic:'precompras'/.test(usersApi) && /topic:'relatorios'/.test(usersApi));
ok('FinBot aprende de respostas humanas', /findLearnedSupportAnswer/.test(usersApi) && /sender_type='agent'/.test(usersApi));
ok('Aprendizado é isolado por tenant', /q\.tenant_id=\$\{tenantId\}/.test(usersApi));
ok('Aprendizado não auto-reforça resposta de bot', /a\.sender_type='agent'/.test(usersApi) && !/a\.sender_type='bot'/.test(usersApi));
ok('Cliente não possui aba Diagnóstico', !/cfg-tab-diagnostico|_renderDiagnostico|action=errors/.test(cfg));
ok('Diagnóstico permanece no painel DEV/Master', /carregarErrosSaaS/.test(master) && /Saúde do Sistema/.test(master) && /client_errors/.test(master));

console.log(`\nResultado: ${10 - fails}/10.`);
if (fails) process.exit(1);
console.log('✅ FinBot, OCR e diagnóstico validados.');
''')

# 7) Atualizar lista de testes e package script.
path = Path('scripts/test-static-all.js')
text = path.read_text().replace("'scripts/test-openai-static.js',", "'scripts/test-finbot-learning-static.js',")
path.write_text(text)

path = Path('package.json')
pkg = json.loads(path.read_text())
scripts = pkg.get('scripts', {})
scripts.pop('test:openai', None)
scripts['test:finbot'] = 'node scripts/test-finbot-learning-static.js'
pkg['scripts'] = scripts
path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')
