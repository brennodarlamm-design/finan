// scripts/seed-initial-emails.js — Popula e-mails iniciais representativos para todos os 5 canais
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { neon } from '@neondatabase/serverless';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      const val = v.join('=').trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k.trim()]) {
        process.env[k.trim()] = val;
      }
    }
  }
}

loadEnv();

const dbUrl = (process.env.DATABASE_OWNER_URL || process.env.DATABASE_URL || '').trim();
if (!dbUrl) {
  console.error('❌ DATABASE_OWNER_URL / DATABASE_URL não configurada no .env.local');
  process.exit(1);
}

const sql = neon(dbUrl);

console.log('🚀 Conectando ao Neon DB para inserir histórico inicial de e-mails...');

const seedMessages = [
  // 1. contato@fingo.api.br — Inbound (Principal da empresa / Recebimento)
  {
    id: `eml_${crypto.randomBytes(8).toString('hex')}`,
    direction: 'inbound',
    channel: 'contato@fingo.api.br',
    sender: 'diretoria@engecon-obras.com.br',
    recipient: 'contato@fingo.api.br',
    reply_to: 'diretoria@engecon-obras.com.br',
    subject: 'Parceria institucional e demonstração para 8 canteiros',
    body_text: 'Olá equipe FinGo! Acompanhamos o lançamento do sistema e temos interesse em uma apresentação institucional para nossa diretoria técnica. Hoje gerenciamos 8 canteiros ativos no estado.',
    body_html: '<p>Olá equipe <strong>FinGo</strong>!</p><p>Acompanhamos o lançamento do sistema e temos interesse em uma apresentação institucional para nossa diretoria técnica. Hoje gerenciamos 8 canteiros ativos no estado.</p><p>Podemos agendar uma demonstração nesta semana?</p>',
    status: 'delivered',
    is_read: false,
    message_id: `<inbound-lead-01@engecon-obras.com.br>`,
    metadata: { lead_source: 'site_contato', priority: 'high' }
  },

  // 2. suporte@fingo.api.br — Outbound (Disparo de Suporte / FinBot)
  {
    id: `eml_${crypto.randomBytes(8).toString('hex')}`,
    direction: 'outbound',
    channel: 'suporte@fingo.api.br',
    sender: 'FinGo Suporte <suporte@fingo.api.br>',
    recipient: 'engenheiro.carlos@vanguardaconstrutora.com',
    reply_to: 'suporte@fingo.api.br',
    subject: 'Chamado FinBot #8841: Atualização da base SINAPI 2026 concluída',
    body_text: 'Olá Carlos! O FinBot concluiu a sincronização da tabela de insumos e composições SINAPI desonerada do seu estado. Seu orçamento já está com os novos coeficientes disponíveis.',
    body_html: '<div style="font-family:sans-serif;padding:16px;"><h3 style="color:#C6FF00;">Chamado FinBot #8841</h3><p>Olá Carlos!</p><p>O <strong>FinBot</strong> concluiu a sincronização da tabela de insumos e composições SINAPI desonerada do seu estado. Seu orçamento já está com os novos coeficientes disponíveis.</p><p style="color:#94a3b8;font-size:12px;">Atendimento FinGo Suporte</p></div>',
    status: 'delivered',
    is_read: true,
    message_id: `<sup-8841@fingo.api.br>`,
    metadata: { ticket_id: '8841', category: 'sinapi_sync' }
  },

  // 3. comercial@fingo.api.br — Outbound (Envio de Fatura / Cobrança)
  {
    id: `eml_${crypto.randomBytes(8).toString('hex')}`,
    direction: 'outbound',
    channel: 'comercial@fingo.api.br',
    sender: 'FinGo Comercial <comercial@fingo.api.br>',
    recipient: 'financeiro@horizonte-edificacoes.com.br',
    reply_to: 'comercial@fingo.api.br',
    subject: 'FinGo — Fatura de Assinatura & Chave PIX (Plano Pro)',
    body_text: 'Olá equipe Horizonte Edificações! Sua fatura mensal de assinatura do FinGo está disponível para liquidação via PIX Instantâneo. Valor: R$ 279,90. Vencimento: em 5 dias.',
    body_html: '<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:8px;"><h2 style="color:#0284c7;">Fatura de Assinatura FinGo</h2><p>Prezada equipe Horizonte Edificações,</p><p>Sua fatura mensal de assinatura do <strong>FinGo (Plano Pro)</strong> está pronta para liquidação via PIX Instantâneo.</p><p><strong>Valor:</strong> R$ 279,90<br><strong>Vencimento:</strong> 05/10/2026</p><p>Agradecemos pela parceria!</p></div>',
    status: 'delivered',
    is_read: true,
    message_id: `<com-fat-202610@fingo.api.br>`,
    metadata: { invoice_id: 'inv_horiz_1026', plan: 'pro', amount_cents: 27990 }
  },

  // 4. comercial@fingo.api.br — Inbound (Resposta de cliente enviando comprovante)
  {
    id: `eml_${crypto.randomBytes(8).toString('hex')}`,
    direction: 'inbound',
    channel: 'comercial@fingo.api.br',
    sender: 'financeiro@horizonte-edificacoes.com.br',
    recipient: 'comercial@fingo.api.br',
    reply_to: 'financeiro@horizonte-edificacoes.com.br',
    subject: 'Re: FinGo — Fatura de Assinatura & Chave PIX (Plano Pro)',
    body_text: 'Boa tarde! Pagamento efetuado com sucesso via chave PIX CNPJ. Segue comprovante anexo para baixa no sistema.',
    body_html: '<p>Boa tarde!</p><p>Pagamento efetuado com sucesso via chave PIX CNPJ. Segue comprovante para baixa no sistema.</p><p>Att,<br>Setor Financeiro Horizonte</p>',
    status: 'delivered',
    is_read: false,
    message_id: `<reply-fat-202610@horizonte-edificacoes.com.br>`,
    in_reply_to: `<com-fat-202610@fingo.api.br>`,
    metadata: { has_attachment: true, attachment_type: 'comprovante_pix' }
  },

  // 5. novidades@fingo.api.br — Outbound (Newsletter Radar FinGo)
  {
    id: `eml_${crypto.randomBytes(8).toString('hex')}`,
    direction: 'outbound',
    channel: 'novidades@fingo.api.br',
    sender: 'FinGo Radar <novidades@fingo.api.br>',
    recipient: 'assinantes@radar.fingo.api.br',
    reply_to: 'contato@fingo.api.br',
    subject: 'Radar FinGo #14 — Lançamento do BIM Viewer 3D Paramétrico e CSG',
    body_text: 'Nesta edição do Radar FinGo: Nova engine 3D em WebGL com importação IFC e CSG paramétrico direto no navegador sem plugins pesados.',
    body_html: '<div style="background:#0A0A0A;color:#F0F0E8;padding:24px;border-radius:12px;"><h1 style="color:#C6FF00;">Radar FinGo · Edição #14</h1><p>Nesta edição: Apresentamos o <strong>FinGo BIM Viewer</strong> com modelagem paramétrica CSG, corte dinâmico e clash detection.</p><p style="color:#94a3b8;font-size:13px;">Você recebe este e-mail porque assinou as novidades do FinGo.</p></div>',
    status: 'delivered',
    is_read: true,
    message_id: `<radar-14@fingo.api.br>`,
    metadata: { edition: 14, campaign: 'bim_launch' }
  },

  // 6. no-reply@fingo.api.br — Outbound (Transacional / OTP / Alerta de Sistema)
  {
    id: `eml_${crypto.randomBytes(8).toString('hex')}`,
    direction: 'outbound',
    channel: 'no-reply@fingo.api.br',
    sender: 'FinGo Notificações <no-reply@fingo.api.br>',
    recipient: 'mestre.antonio@engecon-obras.com.br',
    reply_to: 'no-reply@fingo.api.br',
    subject: 'FinGo — Código de Verificação de Segurança (OTP)',
    body_text: 'Seu código de acesso temporário é: 492810. Ele expira em 10 minutos. Se você não solicitou este código, ignore este e-mail.',
    body_html: '<div style="font-family:sans-serif;max-width:400px;padding:20px;border:1px solid #cbd5e1;border-radius:8px;"><h3 style="margin:0 0 10px;color:#0f172a;">Código de Segurança</h3><p style="font-size:14px;color:#334155;">Seu código de acesso de uso único é:</p><div style="font-size:28px;font-weight:900;letter-spacing:6px;color:#0284c7;text-align:center;padding:12px;background:#f8fafc;border-radius:6px;font-family:monospace;">492810</div><p style="font-size:11px;color:#64748b;margin-top:12px;">Válido por 10 minutos. Mensagem automática — não responda a este e-mail.</p></div>',
    status: 'delivered',
    is_read: true,
    message_id: `<otp-sec-492810@fingo.api.br>`,
    metadata: { type: 'otp_auth', ttl_seconds: 600 }
  }
];

let inserted = 0;
for (const msg of seedMessages) {
  await sql`
    INSERT INTO email_messages (
      id, tenant_id, direction, channel, sender, recipient, reply_to,
      subject, body_text, body_html, status, message_id, in_reply_to, metadata, is_read, created_at, updated_at
    ) VALUES (
      ${msg.id}, NULL, ${msg.direction}, ${msg.channel}, ${msg.sender}, ${msg.recipient}, ${msg.reply_to},
      ${msg.subject}, ${msg.body_text}, ${msg.body_html}, ${msg.status}, ${msg.message_id}, ${msg.in_reply_to || null},
      ${JSON.stringify(msg.metadata)}, ${msg.is_read}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO NOTHING;
  `;
  inserted++;
}

console.log(`✅ ${inserted} mensagens semeadas com sucesso nos 5 canais do FinGo!`);

const countRes = await sql`SELECT channel, direction, COUNT(*)::int as total FROM email_messages GROUP BY channel, direction ORDER BY channel;`;
console.log('📊 Estado atual da tabela email_messages no Neon:');
console.table(countRes);
