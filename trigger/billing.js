// trigger/billing.js — Tarefas Agendadas de Cobrança 24/7 e Resumo Matinal do Canteiro
import { task, schedules, logger } from "@trigger.dev/sdk";
import { neon } from "@neondatabase/serverless";

function getDbClient() {
  const dbUrl = String(process.env.DATABASE_OWNER_URL || '').trim();
  if (!dbUrl) throw new Error("DATABASE_OWNER_URL não configurada para a tarefa administrativa de cobrança.");
  return neon(dbUrl);
}

// ── 1. VARREDURA E RÉGUA DE COBRANÇA 24/7 ───────────────────────────────────
export const scheduledBillingSweep = schedules.task({
  id: "scheduled-billing-sweep",
  cron: "30 12 * * 1-5", // 12:30 UTC = 08:30 Boa Vista / 09:30 Brasília (Segunda a Sexta)
  run: async (payload) => {
    logger.info("Iniciando varredura e régua de cobrança automática 24/7 no Neon Postgres");
    const sql = getDbClient();

    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Boa_Vista', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    let tenants = [];
    try {
      tenants = await sql`
        SELECT id, COALESCE(nome_fantasia, razao_social, id) as nome, email, telefone, status
        FROM tenants
        WHERE status != 'cancelado' AND id != 'public'
        ORDER BY id;
      `;
    } catch (err) {
      logger.error("Erro ao listar tenants no Neon:", { error: err.message });
      throw err;
    }

    logger.info(`Tenants identificados para varredura: ${tenants.length}`);
    const summary = { totalTenants: tenants.length, notifiedEmails: 0, notifiedWhatsApp: 0, skipped: 0 };

    for (const t of tenants) {
      try {
        // Busca faturas vencendo hoje ou já vencidas
        const pendentes = await sql`
          SELECT l.*, o.nome as obra_nome
          FROM lancamentos l
          LEFT JOIN obras o ON l.obra_id = o.id AND l.tenant_id = o.tenant_id
          WHERE l.tenant_id = ${t.id}
            AND l.tipo = 'despesa'
            AND l.status IN ('a_pagar', 'pendente', 'em_atraso')
            AND (DATE(COALESCE(l.data_vencimento, l.data)) <= ${hoje}::date)
          ORDER BY COALESCE(l.data_vencimento, l.data) ASC
          LIMIT 20;
        `;

        if (!pendentes || pendentes.length === 0) {
          summary.skipped++;
          continue;
        }

        // Disparo por E-mail via Resend (se e-mail cadastrado e Resend configurado)
        const resendKey = String(process.env.RESEND_API_KEY || '').trim();
        if (t.email && t.email.includes('@') && resendKey) {
          const totalValor = pendentes.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
          const totalFmt = totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

          const rowsHtml = pendentes.map((p, i) => `
            <tr>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${i + 1}. ${p.fornecedor_beneficiario || p.descricao || 'Despesa'}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">${(Number(p.valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${p.data_vencimento || p.data}</td>
            </tr>
          `).join('');

          const emailHtml = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
              <h2 style="color:#0f172a;">Aviso de Cobrança & Vencimentos — FinGo</h2>
              <p>Olá, <strong>${t.nome}</strong>,</p>
              <p>Identificamos <strong>${pendentes.length} conta(s)</strong> com vencimento hoje ou pendentes no total de <strong>${totalFmt}</strong>:</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
                <thead>
                  <tr style="background:#f8fafc;text-align:left;">
                    <th style="padding:8px;">Favorecido</th>
                    <th style="padding:8px;">Valor</th>
                    <th style="padding:8px;">Vencimento</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
              <p>Acesse o FinGo para liquidar ou programar as transferências bancárias.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <p style="font-size:12px;color:#94a3b8;">Mensagem automática gerada pelo sistema FinGo.</p>
            </div>
          `;

          try {
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resendKey}`
              },
              body: JSON.stringify({
                from: process.env.FINOBRA_SUPPORT_EMAIL_FROM || 'FinGo <suporte@fingo.api.br>',
                to: [t.email],
                subject: `⚠️ Lembrete de Vencimento: ${pendentes.length} conta(s) pendente(s) — FinGo`,
                html: emailHtml
              }),
              signal: AbortSignal.timeout(12000)
            });
            if (!emailRes.ok) {
              logger.warn(`Resend rejeitou e-mail de cobrança para ${t.id}:`, { status: emailRes.status });
            } else {
              summary.notifiedEmails++;
            }
          } catch (emErr) {
            logger.warn(`Falha ao disparar e-mail de cobrança para ${t.id}:`, { error: emErr.message });
          }
        }

        // Registra log para auditoria de cobrança
        try {
          await sql`
            INSERT INTO billing_notifications_sent (tenant_id, sent_date, channel, recipient, status)
            VALUES (${t.id}, ${hoje}::date, 'trigger_sweep', ${t.email || t.telefone || 'n/a'}, 'sent')
            ON CONFLICT DO NOTHING;
          `;
        } catch {}

      } catch (tenantErr) {
        logger.error(`Erro ao processar cobrança do tenant ${t.id}:`, { error: tenantErr.message });
      }
    }

    logger.info("Varredura de cobrança 24/7 concluída", summary);
    return summary;
  }
});

// ── 2. RESUMO MATINAL FINANCEIRO DO CANTEIRO ────────────────────────────────
export const dailyMorningSummary = schedules.task({
  id: "daily-morning-summary",
  cron: "0 12 * * *", // 12:00 UTC = 08:00 Boa Vista / 09:00 Brasília (Todos os dias)
  run: async () => {
    logger.info("Iniciando rotina do Resumo Matinal Financeiro do Canteiro");
    const sql = getDbClient();

    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Boa_Vista', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    const contas = await sql`
      SELECT l.*, o.nome as obra_nome, COALESCE(t.nome_fantasia, t.razao_social, l.tenant_id) as empresa_nome
      FROM lancamentos l
      LEFT JOIN obras o ON l.obra_id = o.id AND l.tenant_id = o.tenant_id
      LEFT JOIN tenants t ON t.id = l.tenant_id
      WHERE l.tipo = 'despesa'
        AND l.status IN ('a_pagar', 'pendente', 'em_atraso')
        AND (DATE(COALESCE(l.data_vencimento, l.data)) <= ${hoje}::date)
      ORDER BY l.tenant_id, COALESCE(l.data_vencimento, l.data) ASC;
    `;

    logger.info(`Total de contas para resumo matinal consolidado: ${contas.length}`);
    return { success: true, date: hoje, totalContas: contas.length };
  }
});
