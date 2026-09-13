// api/users.js — Gestão de usuários por tenant (Neon)
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { hashPassword, verifyPassword, resolveAuthAndTenant } from './_auth.js';
import { writeAudit } from './_audit.js';
import { canManageUsers, canManageTenant, permissionError, sanitizePermissions } from './_permissions.js';
import { getPlanRule } from './_plans.js';
import { checkRateLimit, getClientIp } from './_ratelimit.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

function cors(req, res) {
  const allowed = ['https://finobra.app.br','https://www.finobra.app.br','http://localhost:3000','http://localhost:3333','http://localhost:5000','http://127.0.0.1:3000','http://127.0.0.1:3333','http://127.0.0.1:5000'];
  const origin = req.headers.origin;
  if (origin && (allowed.includes(origin) || /^https:\/\/finan-as(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(origin))) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-tenant-id');
}

const safeUser = u => ({
  id: u.id, username: u.username, email: u.email || '', nome: u.nome,
  perfil: u.perfil, avatar: u.avatar || (u.nome || 'US').slice(0,2).toUpperCase(),
  ativo: !!u.ativo, tenantId: u.tenant_id, googleAuth: !!u.google_auth,
  permissions: (u.permissoes && typeof u.permissoes === 'object') ? u.permissoes : {},
  created_at: u.created_at
});

async function getUserPlanUsage(sql, tenantId) {
  const tenantRows = await sql`SELECT plano FROM tenants WHERE id=${tenantId} LIMIT 1;`;
  const rule = getPlanRule(tenantRows[0]?.plano || 'trial');
  const countRows = await sql`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE ativo=TRUE)::int AS active
    FROM usuarios WHERE tenant_id=${tenantId};
  `;
  const activeUsers = Number(countRows[0]?.active || 0);
  const totalUsers = Number(countRows[0]?.total || 0);
  return {
    planId: rule.id,
    planLabel: rule.label,
    maxUsers: rule.maxUsers,
    activeUsers,
    totalUsers,
    remainingUsers: rule.maxUsers == null ? null : Math.max(0, rule.maxUsers - activeUsers)
  };
}

function planUserLimitError(usage) {
  return {
    success:false,
    code:'PLAN_USER_LIMIT',
    plan:usage.planId,
    limit:usage.maxUsers,
    current:usage.activeUsers,
    error:`Seu time chegou ao limite do ${usage.planLabel}. Este plano inclui ${usage.maxUsers} usuário(s) ativo(s). Para adicionar outra pessoa, gerencie os usuários atuais ou consulte um plano com mais acessos.`
  };
}


const SUPPORT_STATUSES = new Set(['bot','waiting','assigned','resolved','closed']);
const cleanSupportText = (v, max=4000) => String(v ?? '').replace(/\0/g, '').trim().slice(0, max);
const wantsHumanSupport = text => /\b(atendente|humano|pessoa|especialista|falar com algu[eé]m|suporte humano|chamar suporte|chamar atendente)\b/i.test(String(text || ''));

const SUPPORT_KB = Object.freeze([
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
]);

function supportBotReply(text) {
  const t = String(text || '').trim();
  if (/(atendente|humano|pessoa|especialista|falar com algu[eé]m)/i.test(t)) return null;
  for (const item of SUPPORT_KB) {
    if (item.patterns.some(re => re.test(t))) return item.answer;
  }
  return 'Posso ajudar com Obras, Financeiro, NF-e/OCR, Medições, OFX, Fornecedores, Contratos, Recibos, Usuários e Permissões, Sessões, Assinaturas, WhatsApp e Planos. Escreva sua dúvida ou clique em “Chamar atendente” para falar com uma pessoa.';
}

const SUPPORT_STOP_WORDS = new Set(['a','o','as','os','de','da','do','das','dos','e','em','no','na','nos','nas','um','uma','uns','umas','para','por','com','sem','que','como','eu','me','meu','minha','meus','minhas','voce','voces','isso','isto','essa','esse','ao','aos']);

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

function getSupportRenderBaseUrl() {
  const custom = String(process.env.RENDER_WHATSAPP_URL || '').trim();
  return custom ? custom.replace(/\/send-message\/?$/, '').replace(/\/+$/, '') : 'https://finan-wf12.onrender.com';
}

function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getFormattedSupportTime() {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Manaus',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());
  } catch {
    return new Date().toLocaleString('pt-BR');
  }
}

function renderSupportEmailHtml(vars) {
  const empresa = escapeHtml(vars.EMPRESA);
  const cliente = escapeHtml(vars.CLIENTE);
  const emailCliente = escapeHtml(vars.EMAIL_CLIENTE);
  const chamadoId = escapeHtml(vars.CHAMADO_ID);
  const horario = escapeHtml(vars.HORARIO);
  const mensagem = escapeHtml(vars.MENSAGEM).replace(/\r?\n/g, '<br>');
  const urlAtendimento = encodeURI(vars.URL_ATENDIMENTO);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo atendimento no FinObra — ${empresa}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <!-- Preview text / Preheader -->
  <span style="display:none !important;visibility:hidden;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${cliente} solicitou atendimento humano no FinObra.
  </span>

  <div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
    <div style="max-width:620px;margin:0 auto;padding:32px 16px;">
      
      <div style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
        
        <div style="background:#111827;padding:24px 28px;">
          <div style="font-size:22px;font-weight:700;color:#ffffff;">
            FinObra
          </div>
          <div style="font-size:13px;color:#d1d5db;margin-top:4px;">
            Central de Atendimento
          </div>
        </div>

        <div style="padding:28px;">
          
          <div style="display:inline-block;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:700;padding:7px 12px;border-radius:999px;margin-bottom:18px;">
            ATENDIMENTO AGUARDANDO
          </div>

          <h1 style="font-size:22px;margin:0 0 12px;color:#111827;">
            Um cliente solicitou atendimento humano
          </h1>

          <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#4b5563;">
            O FinBot encaminhou uma conversa para a Central de Atendimento DEV.
          </p>

          <div style="background:#f9fafb;border-radius:10px;padding:18px;margin-bottom:22px;">
            
            <div style="margin-bottom:12px;">
              <strong>Empresa:</strong><br>
              ${empresa}
            </div>

            <div style="margin-bottom:12px;">
              <strong>Cliente:</strong><br>
              ${cliente}
            </div>

            <div style="margin-bottom:12px;">
              <strong>E-mail:</strong><br>
              ${emailCliente}
            </div>

            <div style="margin-bottom:12px;">
              <strong>Chamado:</strong><br>
              ${chamadoId}
            </div>

            <div>
              <strong>Horário:</strong><br>
              ${horario}
            </div>

          </div>

          <div style="margin-bottom:24px;">
            <div style="font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;margin-bottom:8px;">
              Última mensagem
            </div>

            <div style="background:#eef2ff;border-left:4px solid #4f46e5;padding:16px;border-radius:6px;font-size:15px;line-height:1.6;">
              ${mensagem}
            </div>
          </div>

          <div style="text-align:center;margin:30px 0;">
            <a href="${urlAtendimento}"
               style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 24px;border-radius:8px;">
              Abrir Central de Atendimento
            </a>
          </div>

          <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0;">
            Este aviso foi gerado automaticamente pelo FinObra após o cliente solicitar atendimento humano.
          </p>

        </div>

        <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 28px;text-align:center;font-size:12px;color:#9ca3af;">
          FinObra • Gestão para Construção
        </div>

      </div>
    </div>
  </div>
</body>
</html>`;
}

async function notifySupportHuman({ tenantName, userName, userEmail, conversationId, message }) {
  const tasks = [];
  const notifyPhone = String(process.env.FINOBRA_SUPPORT_WHATSAPP || '5595991363678').replace(/\D/g, '');
  const internalSecret = String(process.env.API_SECRET || process.env.VERCEL_API_SECRET || '').trim();
  if (notifyPhone && internalSecret) {
    const text = `🔔 *FinObra — Atendimento solicitado*\n\nEmpresa: ${tenantName || 'Cliente'}\nUsuário: ${userName || 'Usuário'}\nChamado: ${conversationId}\nMensagem: ${cleanSupportText(message, 500) || 'Cliente solicitou atendimento humano.'}\n\nAbra o painel Master > Central de Atendimento.`;
    tasks.push(fetch(`${getSupportRenderBaseUrl()}/send-message`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${internalSecret}`, 'x-api-key':internalSecret, 'User-Agent':'FinObra-Support/1.0' },
      body: JSON.stringify({ phone: notifyPhone, number: notifyPhone, message:text, text }),
      signal: AbortSignal.timeout(7000)
    }).catch(() => null));
  }

  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  const emailFrom = String(process.env.FINOBRA_SUPPORT_EMAIL_FROM || 'FinObra <onboarding@resend.dev>').trim();
  const emailTo = String(process.env.FINOBRA_SUPPORT_EMAIL || 'brennodarlam@gmail.com').trim();
  const templateId = String(process.env.RESEND_SUPPORT_TEMPLATE_ID || '').trim();

  if (resendKey && emailFrom && emailTo) {
    const vars = {
      EMPRESA: String(tenantName || 'Cliente FinObra').trim(),
      CLIENTE: String(userName || 'Cliente').trim(),
      EMAIL_CLIENTE: String(userEmail || 'Não informado').trim(),
      CHAMADO_ID: String(conversationId || 'Não informado').trim(),
      HORARIO: getFormattedSupportTime(),
      MENSAGEM: cleanSupportText(message, 1500) || 'Cliente solicitou atendimento.',
      URL_ATENDIMENTO: String(process.env.FINOBRA_MASTER_URL || 'https://finobra.app.br/master.html').trim()
    };

    const payload = {
      from: emailFrom,
      to: [emailTo],
      subject: `🔔 Novo atendimento no FinObra — ${vars.EMPRESA}`
    };

    if (templateId) {
      payload.template = {
        id: templateId,
        variables: vars
      };
    } else {
      payload.html = renderSupportEmailHtml(vars);
    }

    tasks.push(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
        'Idempotency-Key': `support/${conversationId}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(7000)
    }).catch(err => {
      console.error('[Resend Support Email Error]', err?.message || err);
      return null;
    }));
  }
  if (tasks.length) await Promise.allSettled(tasks);
}

async function loadSupportConversation(sql, auth, conversationId='') {
  const rows = conversationId
    ? await sql`SELECT * FROM support_conversations WHERE id=${conversationId} AND tenant_id=${auth.tenantId} AND user_id=${auth.user.userId} LIMIT 1;`
    : await sql`SELECT * FROM support_conversations WHERE tenant_id=${auth.tenantId} AND user_id=${auth.user.userId} AND status IN ('bot','waiting','assigned') ORDER BY updated_at DESC LIMIT 1;`;
  return rows[0] || null;
}

async function loadSupportMessages(sql, auth, conversationId) {
  return sql`
    SELECT id, conversation_id, sender_type, sender_name, body, created_at
    FROM support_messages
    WHERE conversation_id=${conversationId} AND tenant_id=${auth.tenantId}
    ORDER BY created_at ASC, id ASC
    LIMIT 500;
  `;
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) return res.status(auth.status || 401).json({ success:false, error:auth.error });
  if (auth.isSystem) return res.status(403).json({ success:false, error:'Use uma sessão de usuário para gerenciar usuários.' });

  const sql = getSql();
  const target = req.query.target || req.body?.target || '';

  // ── Central de Suporte do CLIENTE (compartilhada via Neon) ───────────────
  if (target === 'support') {
    if (auth.user?.isImpersonated || auth.user?.impersonatedBy) {
      return res.status(403).json({ success:false, error:'No modo suporte Master, use a Central de Atendimento DEV.' });
    }
    const action = String(req.query.action || req.body?.action || 'current').trim().toLowerCase();
    try {
      if (req.method === 'GET') {
        const conversation = await loadSupportConversation(sql, auth, String(req.query.conversationId || '').trim());
        if (!conversation) return res.status(200).json({ success:true, conversation:null, messages:[] });
        const messages = await loadSupportMessages(sql, auth, conversation.id);
        return res.status(200).json({ success:true, conversation, messages });
      }

      if (req.method !== 'POST') return res.status(405).json({ success:false, error:'Método não permitido.' });

      const rl = await checkRateLimit(`support:${auth.tenantId}:${auth.user.userId}:${getClientIp(req)}`, 40, 60000);
      if (!rl.allowed) return res.status(429).json({ success:false, error:'Muitas mensagens em pouco tempo. Aguarde alguns instantes.' });

      if (action === 'start') {
        let conversation = await loadSupportConversation(sql, auth);
        if (!conversation) {
          const id = 'sup_' + crypto.randomBytes(10).toString('hex');
          const rows = await sql`
            INSERT INTO support_conversations (id,tenant_id,user_id,status,last_message_at,created_at,updated_at)
            VALUES (${id},${auth.tenantId},${auth.user.userId},'bot',NOW(),NOW(),NOW())
            RETURNING *;
          `;
          conversation = rows[0];
          await sql`
            INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_user_id,sender_name,body)
            VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${id},${auth.tenantId},'bot',NULL,'FinBot',${`Olá, ${auth.user.nome || 'tudo bem'}! Sou o FinBot, assistente do FinObra. Posso responder dúvidas sobre o sistema. Se preferir falar com uma pessoa, clique em “Chamar atendente”.`});
          `;
        }
        const messages = await loadSupportMessages(sql, auth, conversation.id);
        return res.status(200).json({ success:true, conversation, messages });
      }

      const conversationId = cleanSupportText(req.body?.conversationId, 80);
      if (!conversationId) return res.status(400).json({ success:false, error:'Conversa não informada.' });
      let conversation = await loadSupportConversation(sql, auth, conversationId);
      if (!conversation) return res.status(404).json({ success:false, error:'Conversa não encontrada.' });

      if (action === 'message') {
        const text = cleanSupportText(req.body?.text, 4000);
        if (!text) return res.status(400).json({ success:false, error:'Digite uma mensagem.' });
        await sql`
          INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_user_id,sender_name,body)
          VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'client',${auth.user.userId},${auth.user.nome || auth.user.username || 'Cliente'},${text});
        `;
        await sql`UPDATE support_conversations SET last_message_at=NOW(), updated_at=NOW() WHERE id=${conversation.id};`;

        if (wantsHumanSupport(text) && conversation.status === 'bot') {
          await sql`UPDATE support_conversations SET status='waiting', human_requested_at=COALESCE(human_requested_at,NOW()), last_message_at=NOW(), updated_at=NOW() WHERE id=${conversation.id};`;
          await sql`
            INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_name,body)
            VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'system','FinObra',${'Atendimento humano solicitado. Sua conversa entrou na fila do suporte.'});
          `;
        } else if (conversation.status === 'bot') {
          let reply = null;
          try {
            reply = await findLearnedSupportAnswer(sql, auth.tenantId, text);
          } catch (eLearn) {
            console.warn('[FinBot] Falha ao consultar memória aprendida:', eLearn?.message || eLearn);
          }
          if (!reply) {
            reply = supportBotReply(text);
          }
          if (reply) {
            await sql`
              INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_name,body)
              VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'bot','FinBot',${reply});
            `;
            await sql`UPDATE support_conversations SET last_message_at=NOW(), updated_at=NOW() WHERE id=${conversation.id};`;
          }
        }

        conversation = await loadSupportConversation(sql, auth, conversation.id);
        if (conversation.status === 'waiting' && !conversation.notified_at) {
          const tenantRows = await sql`SELECT COALESCE(nome_fantasia,razao_social,id) AS nome FROM tenants WHERE id=${auth.tenantId} LIMIT 1;`;
          await notifySupportHuman({
            tenantName: tenantRows[0]?.nome,
            userName: auth.user.nome,
            userEmail: auth.user.email,
            conversationId: conversation.id,
            message: text
          });
          await sql`UPDATE support_conversations SET notified_at=NOW() WHERE id=${conversation.id} AND notified_at IS NULL;`;
        }
        const messages = await loadSupportMessages(sql, auth, conversation.id);
        return res.status(200).json({ success:true, conversation, messages });
      }

      if (action === 'escalate') {
        if (conversation.status === 'bot') {
          await sql`UPDATE support_conversations SET status='waiting', human_requested_at=COALESCE(human_requested_at,NOW()), last_message_at=NOW(), updated_at=NOW() WHERE id=${conversation.id};`;
          await sql`
            INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_name,body)
            VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'system','FinObra',${'Atendimento humano solicitado. Sua conversa entrou na fila do suporte.'});
          `;
        }
        conversation = await loadSupportConversation(sql, auth, conversation.id);
        if (!conversation.notified_at) {
          const tenantRows = await sql`SELECT COALESCE(nome_fantasia,razao_social,id) AS nome FROM tenants WHERE id=${auth.tenantId} LIMIT 1;`;
          const lastRows = await sql`SELECT body FROM support_messages WHERE conversation_id=${conversation.id} AND sender_type='client' ORDER BY created_at DESC LIMIT 1;`;
          await notifySupportHuman({
            tenantName: tenantRows[0]?.nome,
            userName: auth.user.nome,
            userEmail: auth.user.email,
            conversationId: conversation.id,
            message: lastRows[0]?.body || 'Cliente solicitou atendimento humano.'
          });
          await sql`UPDATE support_conversations SET notified_at=NOW() WHERE id=${conversation.id} AND notified_at IS NULL;`;
        }
        const messages = await loadSupportMessages(sql, auth, conversation.id);
        return res.status(200).json({ success:true, conversation, messages, notified:true });
      }

      if (action === 'close') {
        await sql`UPDATE support_conversations SET status='closed', resolved_at=COALESCE(resolved_at,NOW()), updated_at=NOW() WHERE id=${conversation.id};`;
        await sql`
          INSERT INTO support_messages (id,conversation_id,tenant_id,sender_type,sender_name,body)
          VALUES (${`smsg_${crypto.randomBytes(10).toString('hex')}`},${conversation.id},${auth.tenantId},'system','FinObra',${'Conversa encerrada pelo cliente.'});
        `;
        return res.status(200).json({ success:true });
      }

      return res.status(400).json({ success:false, error:'Ação de suporte desconhecida.' });
    } catch (err) {
      console.error('[Support Client API]', err);
      return res.status(500).json({ success:false, error:'Não foi possível acessar o atendimento agora.' });
    }
  }

  // ── Integração Transparente com /api/tenant (limite 12 funções Vercel) ──
  if (target === 'tenant') {
    const pickTenant = t => ({
      id: t.id,
      razao_social: t.razao_social || '',
      nome_fantasia: t.nome_fantasia || '',
      cnpj: t.cnpj || '',
      telefone: t.telefone || '',
      email: t.email || '',
      cidade: t.cidade || '',
      uf: t.uf || '',
      endereco: t.endereco || '',
      responsavel: t.responsavel || '',
      logo_url: t.logo_url || '',
      crea_cau: t.crea_cau || '',
      plano: t.plano || 'trial',
      status: t.status || 'trial',
      vencimento: t.vencimento ? String(t.vencimento).slice(0, 10) : '',
      created_at: t.created_at
    });

    try {
      const rows = await sql`SELECT * FROM tenants WHERE id=${auth.tenantId} LIMIT 1;`;
      if (!rows.length) return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
      if (req.method === 'GET') return res.status(200).json({ success: true, tenant: pickTenant(rows[0]) });
      if (req.method === 'PATCH') {
        if (!canManageTenant(auth)) return res.status(403).json(permissionError('ROLE_MANAGE_TENANT_FORBIDDEN'));
        const b = req.body || {};
        const before = pickTenant(rows[0]);
        const nome = String(b.nome_fantasia ?? before.nome_fantasia).trim();
        const razao = String(b.razao_social ?? before.razao_social ?? nome).trim();
        if (!nome) return res.status(400).json({ success: false, error: 'Nome fantasia é obrigatório.' });
        const uf = String(b.uf ?? before.uf).trim().toUpperCase().slice(0, 2);
        const updated = await sql`
          UPDATE tenants SET
            nome_fantasia=${nome}, razao_social=${razao || nome}, cnpj=${String(b.cnpj ?? before.cnpj).trim() || null},
            telefone=${String(b.telefone ?? before.telefone).trim() || null}, email=${String(b.email ?? before.email).trim().toLowerCase() || null},
            cidade=${String(b.cidade ?? before.cidade).trim() || null}, uf=${uf || null}, endereco=${String(b.endereco ?? before.endereco).trim() || null},
            responsavel=${String(b.responsavel ?? before.responsavel).trim() || null}, logo_url=${String(b.logo_url ?? before.logo_url).trim() || null},
            crea_cau=${String(b.crea_cau ?? before.crea_cau).trim() || null}, updated_at=NOW()
          WHERE id=${auth.tenantId}
          RETURNING *;
        `;
        const after = pickTenant(updated[0]);
        await writeAudit(sql, req, auth, { acao: 'atualizar', entidade: 'tenant', entidadeId: auth.tenantId, antes: before, depois: after });
        return res.status(200).json({ success: true, tenant: after });
      }
      return res.status(405).json({ success: false, error: 'Método não permitido.' });
    } catch (err) {
      console.error('[Tenant API]', err);
      return res.status(500).json({ success: false, error: 'Erro interno ao atualizar a empresa.' });
    }
  }

  const actorIsAdmin = canManageUsers(auth);
  const action = req.query.action || req.body?.action || '';

  try {
    if (req.method === 'GET') {
      const rows = actorIsAdmin
        ? await sql`
            SELECT id, tenant_id, username, email, nome, perfil, avatar, ativo, google_auth, permissoes, created_at
            FROM usuarios WHERE tenant_id = ${auth.tenantId}
            ORDER BY CASE WHEN id = ${auth.user.userId} THEN 0 ELSE 1 END, nome ASC;
          `
        : await sql`
            SELECT id, tenant_id, username, email, nome, perfil, avatar, ativo, google_auth, permissoes, created_at
            FROM usuarios WHERE tenant_id = ${auth.tenantId} AND id = ${auth.user.userId}
            LIMIT 1;
          `;
      const planUsage = await getUserPlanUsage(sql, auth.tenantId);
      return res.status(200).json({ success:true, users:rows.map(safeUser), limited:!actorIsAdmin, planUsage });
    }

    if (req.method === 'POST') {
      if (!actorIsAdmin) return res.status(403).json(permissionError('ROLE_MANAGE_USERS_FORBIDDEN'));
      const { nome, username, email, senha, perfil='gestor', avatar='', permissions={} } = req.body || {};
      const n = String(nome || '').trim();
      const un = String(username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
      const em = String(email || '').trim().toLowerCase();
      const pw = String(senha || '');
      const allowedProfiles = ['admin','gestor','visualizador','operador'];
      if (!n || un.length < 3 || !em || !em.includes('@') || pw.length < 8) {
        return res.status(400).json({ success:false, error:'Informe nome, usuário (mín. 3), e-mail válido e senha (mín. 8).' });
      }
      if (!allowedProfiles.includes(perfil)) return res.status(400).json({ success:false, error:'Perfil inválido.' });
      const planUsage = await getUserPlanUsage(sql, auth.tenantId);
      if (planUsage.maxUsers != null && planUsage.activeUsers >= planUsage.maxUsers) {
        return res.status(409).json(planUserLimitError(planUsage));
      }
      const exists = await sql`SELECT id FROM usuarios WHERE LOWER(username)=${un} OR LOWER(email)=${em} LIMIT 1;`;
      if (exists.length) return res.status(409).json({ success:false, error:'Usuário ou e-mail já cadastrado.' });
      const id = 'usr_' + crypto.randomBytes(8).toString('hex');
      const senhaHash = hashPassword(pw);
      const cleanPermissions = ['admin','superadmin'].includes(String(perfil)) ? {} : sanitizePermissions(permissions);
      const permissionsJson = JSON.stringify(cleanPermissions);
      const rows = await sql`
        INSERT INTO usuarios (id,tenant_id,username,email,senha_hash,nome,perfil,avatar,ativo,permissoes)
        VALUES (${id},${auth.tenantId},${un},${em},${senhaHash},${n},${perfil},${String(avatar||'').trim() || n.slice(0,2).toUpperCase()},TRUE,${permissionsJson}::jsonb)
        RETURNING id,tenant_id,username,email,nome,perfil,avatar,ativo,google_auth,permissoes,created_at;
      `;
      await writeAudit(sql, req, auth, { acao:'criar', entidade:'usuario', entidadeId:id, depois:safeUser(rows[0]) });
      return res.status(201).json({ success:true, user:safeUser(rows[0]) });
    }

    if (req.method === 'PATCH') {
      const { id, nome, username, email, perfil, avatar, ativo, senha, senha_atual, permissions } = req.body || {};
      const targetId = String(id || auth.user.userId);
      const isSelf = targetId === auth.user.userId;
      if (!isSelf && !actorIsAdmin) return res.status(403).json({ success:false, error:'Sem permissão para alterar outro usuário.' });

      const currentRows = await sql`SELECT * FROM usuarios WHERE id=${targetId} AND tenant_id=${auth.tenantId} LIMIT 1;`;
      if (!currentRows.length) return res.status(404).json({ success:false, error:'Usuário não encontrado.' });
      const cur = currentRows[0];
      // Um administrador de tenant nunca pode alterar uma conta superadmin.
      // Apenas outro superadmin autenticado pode fazê-lo.
      if (cur.perfil === 'superadmin' && auth.user.perfil !== 'superadmin') {
        return res.status(403).json({ success:false, error:'Conta superadmin protegida.' });
      }

      const newNome = nome !== undefined ? String(nome).trim() : cur.nome;
      const newUsername = username !== undefined ? String(username).trim().toLowerCase().replace(/[^a-z0-9._-]/g,'') : cur.username;
      const newEmail = email !== undefined ? String(email).trim().toLowerCase() : cur.email;
      const allowedProfiles = ['admin','gestor','visualizador','operador'];
      // Usuário comum pode editar seus próprios dados, mas nunca promover a si mesmo
      // nem reativar/desativar a própria conta via payload manual.
      const newPerfil = actorIsAdmin && perfil !== undefined ? String(perfil) : cur.perfil;
      const newAtivo = actorIsAdmin && ativo !== undefined ? !!ativo : !!cur.ativo;
      const newAvatar = avatar !== undefined ? (String(avatar).trim() || newNome.slice(0,2).toUpperCase()) : cur.avatar;

      if (!newNome || newUsername.length < 3 || !newEmail || !newEmail.includes('@')) return res.status(400).json({ success:false, error:'Dados de usuário inválidos.' });
      if (!allowedProfiles.includes(newPerfil)) return res.status(400).json({ success:false, error:'Perfil inválido.' });
      if (isSelf && !newAtivo) return res.status(400).json({ success:false, error:'Você não pode desativar sua própria conta.' });

      // Evita deixar a empresa sem nenhum administrador ativo, o que bloquearia a gestão de usuários/empresa.
      if (cur.perfil === 'admin' && cur.ativo && (newPerfil !== 'admin' || !newAtivo)) {
        const otherAdmins = await sql`
          SELECT COUNT(*)::int AS total
          FROM usuarios
          WHERE tenant_id=${auth.tenantId} AND id<>${targetId} AND perfil='admin' AND ativo=TRUE;
        `;
        if (Number(otherAdmins[0]?.total || 0) < 1) {
          return res.status(409).json({ success:false, code:'LAST_ADMIN', error:'A empresa precisa manter pelo menos um administrador ativo. Crie ou promova outro administrador antes desta alteração.' });
        }
      }

      if (!cur.ativo && newAtivo) {
        const planUsage = await getUserPlanUsage(sql, auth.tenantId);
        if (planUsage.maxUsers != null && planUsage.activeUsers >= planUsage.maxUsers) {
          return res.status(409).json(planUserLimitError(planUsage));
        }
      }

      const dup = await sql`SELECT id FROM usuarios WHERE id<>${targetId} AND (LOWER(username)=${newUsername} OR LOWER(email)=${newEmail}) LIMIT 1;`;
      if (dup.length) return res.status(409).json({ success:false, error:'Usuário ou e-mail já utilizado.' });

      let senhaHash = cur.senha_hash;
      if (senha) {
        if (String(senha).length < 8) return res.status(400).json({ success:false, error:'A nova senha deve ter no mínimo 8 caracteres.' });
        if (isSelf && !actorIsAdmin) {
          if (!senha_atual || !verifyPassword(String(senha_atual), cur.senha_hash)) return res.status(403).json({ success:false, error:'Senha atual incorreta.' });
        }
        // Mesmo admin alterando a própria senha deve confirmar a atual.
        if (isSelf && actorIsAdmin && (!senha_atual || !verifyPassword(String(senha_atual), cur.senha_hash))) {
          return res.status(403).json({ success:false, error:'Senha atual incorreta.' });
        }
        senhaHash = hashPassword(String(senha));
      }

      const newPermissions = ['admin','superadmin'].includes(String(newPerfil)) ? {} : (actorIsAdmin && permissions !== undefined ? sanitizePermissions(permissions) : ((cur.permissoes && typeof cur.permissoes === 'object') ? cur.permissoes : {}));
      const permissionsJson = JSON.stringify(newPermissions);
      const rows = await sql`
        UPDATE usuarios SET
          nome=${newNome}, username=${newUsername}, email=${newEmail}, perfil=${newPerfil},
          avatar=${newAvatar}, ativo=${newAtivo}, senha_hash=${senhaHash}, permissoes=${permissionsJson}::jsonb, updated_at=NOW()
        WHERE id=${targetId} AND tenant_id=${auth.tenantId}
        RETURNING id,tenant_id,username,email,nome,perfil,avatar,ativo,google_auth,permissoes,created_at;
      `;

      // Troca de senha invalida sessões antigas. Na troca da própria senha,
      // preserva apenas a sessão atual para não expulsar o usuário que acabou de confirmar a senha.
      if (senha) {
        if (isSelf && auth.user.sessionId) {
          await sql`UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=${targetId} AND id<>${auth.user.sessionId} AND revoked_at IS NULL;`;
        } else {
          await sql`UPDATE auth_sessions SET revoked_at=NOW() WHERE user_id=${targetId} AND revoked_at IS NULL;`;
        }
      }

      await writeAudit(sql, req, auth, { acao:'atualizar', entidade:'usuario', entidadeId:targetId, antes:safeUser(cur), depois:safeUser(rows[0]) });
      return res.status(200).json({ success:true, user:safeUser(rows[0]) });
    }

    return res.status(405).json({ success:false, error:'Método não permitido.' });
  } catch (err) {
    console.error('[Users API]', err);
    return res.status(500).json({ success:false, error:'Erro interno ao gerenciar usuários.' });
  }
}
