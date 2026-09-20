// trigger/maintenance.js — Tarefas de Manutenção, Auditoria de SLAs e Otimização Neon 24/7
import { task, schedules, logger } from "@trigger.dev/sdk";
import { neon } from "@neondatabase/serverless";

function getDbClient() {
  const dbUrl = String(process.env.DATABASE_OWNER_URL || '').trim();
  if (!dbUrl) throw new Error("DATABASE_OWNER_URL não configurada para a tarefa administrativa de manutenção.");
  return neon(dbUrl);
}

/**
 * ── 1. AUDITORIA DIÁRIA DE PROCESSOS E SLAS DE OBRAS (07:30 Boa Vista / 08:30 Brasília) ──
 * Varre todas as obras ativas no Neon Postgres, audita prazos contratuais e marcos do cronograma.
 */
export const dailySlaAudit = schedules.task({
  id: "daily-sla-audit",
  cron: "30 11 * * *", // 11:30 UTC = 07:30 Boa Vista / 08:30 Brasília (Diário)
  run: async (payload) => {
    logger.info("Iniciando auditoria preventiva de processos e SLAs no canteiro de obras");
    const sql = getDbClient();

    const hoje = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Boa_Vista', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date());

    const hojeDate = new Date(`${hoje}T00:00:00Z`);

    let activeObras = [];
    try {
      activeObras = await sql`
        SELECT o.id, o.tenant_id, o.nome, o.cliente, o.data_inicio, o.data_previsao, o.cronograma_config,
               t.nome_fantasia, t.email as tenant_email, t.telefone as tenant_telefone
        FROM obras o
        LEFT JOIN tenants t ON t.id = o.tenant_id
        WHERE o.status NOT IN ('concluida', 'cancelada', 'arquivada')
          AND o.cronograma_config IS NOT NULL
        ORDER BY o.tenant_id, o.nome;
      `;
    } catch (err) {
      logger.error("Erro ao listar obras ativas para auditoria SLA:", { error: err.message });
      throw err;
    }

    logger.info(`Total de obras ativas com cronograma configurado: ${activeObras.length}`);
    const summary = {
      totalObras: activeObras.length,
      obrasComAtraso: 0,
      totalProcessosAtrasados: 0,
      notificacoesDespachadas: 0
    };

    const atrasosPorTenant = new Map();

    for (const obra of activeObras) {
      let cfg = obra.cronograma_config;
      if (typeof cfg === 'string') {
        try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
      }

      const processos = Array.isArray(cfg?.processos_sla) ? cfg.processos_sla : [];
      if (processos.length === 0) continue;

      const processosAtrasados = [];

      for (const p of processos) {
        if (!p || p.status === 'concluido') continue;

        let dataLimite = null;
        if (p.data_fim_real) {
          dataLimite = new Date(`${p.data_fim_real}T00:00:00Z`);
        } else if (p.data_inicio_real && p.dias_sla) {
          const inicio = new Date(`${p.data_inicio_real}T00:00:00Z`);
          dataLimite = new Date(inicio.getTime() + (Number(p.dias_sla) || 30) * 86400000);
        }

        if (dataLimite && !isNaN(dataLimite.getTime())) {
          if (hojeDate > dataLimite) {
            const diasEmAtraso = Math.round((hojeDate.getTime() - dataLimite.getTime()) / 86400000);
            processosAtrasados.push({
              id: p.id,
              nome: p.nome || p.codigo || 'Etapa',
              dias_sla: p.dias_sla,
              diasEmAtraso,
              status: p.status,
              percentual: p.percentual || 0,
              responsavel: p.cargo_responsavel || 'Não atribuído'
            });
          }
        }
      }

      if (processosAtrasados.length > 0) {
        summary.obrasComAtraso++;
        summary.totalProcessosAtrasados += processosAtrasados.length;

        const tenantKey = obra.tenant_id;
        if (!atrasosPorTenant.has(tenantKey)) {
          atrasosPorTenant.set(tenantKey, {
            tenantId: tenantKey,
            email: obra.tenant_email,
            nomeEmpresa: obra.nome_fantasia || tenantKey,
            obrasAtrasadas: []
          });
        }

        atrasosPorTenant.get(tenantKey).obrasAtrasadas.push({
          obraId: obra.id,
          obraNome: obra.nome,
          processos: processosAtrasados
        });
      }
    }

    logger.info("Auditoria de SLAs concluída.", summary);

    // Opcional: Despachar alerta consolidado para gestores com pendências críticas
    const resendKey = String(process.env.RESEND_API_KEY || '').trim();
    if (resendKey && atrasosPorTenant.size > 0) {
      for (const [tenantId, info] of atrasosPorTenant.entries()) {
        if (!info.email || !info.email.includes('@')) continue;

        try {
          const emailFrom = String(process.env.FINOBRA_SUPPORT_EMAIL_FROM || 'FinGo <suporte@fingo.api.br>').trim();
          const subject = `⚠️ FinGo — Alerta de Processos com SLA Expirado (${info.obrasAtrasadas.length} obra(s))`;

          let itensHtml = '';
          for (const item of info.obrasAtrasadas) {
            itensHtml += `
              <div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #fff;">
                <h3 style="margin: 0 0 8px 0; font-size: 15px; color: #0f172a;">🏗️ Obra: ${item.obraNome}</h3>
                <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569;">
                  ${item.processos.map(p => `
                    <li style="margin-bottom: 4px;">
                      <strong>${p.nome}</strong>: <span style="color: #dc2626; font-weight: 600;">${p.diasEmAtraso} dia(s) atrasado</span> (${p.percentual}% concluído — Resp: ${p.responsavel})
                    </li>
                  `).join('')}
                </ul>
              </div>
            `;
          }

          const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
              <div style="background: #0f172a; padding: 20px; border-radius: 8px 8px 0 0; color: #fff;">
                <h2 style="margin: 0; font-size: 18px;">Relatório Preventivo de Cronograma & SLAs</h2>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">${info.nomeEmpresa} · Auditoria Diária Automatizada</p>
              </div>
              <div style="padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; background: #f8fafc;">
                <p style="margin: 0 0 16px 0; font-size: 14px;">Identificamos etapas de cronograma com prazo de execução expirado que requerem alinhamento operacional:</p>
                ${itensHtml}
                <div style="text-align: center; margin-top: 24px;">
                  <a href="https://fingo.api.br/app.html" style="background: #0284c7; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">Abrir Hub da Obra</a>
                </div>
              </div>
            </div>
          `;

          const emailRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: emailFrom,
              to: [info.email],
              subject,
              html
            }),
            signal: AbortSignal.timeout(12000)
          });

          if (emailRes.ok) {
            summary.notificacoesDespachadas++;
          } else {
            logger.warn(`Resend rejeitou alerta SLA do tenant ${tenantId}:`, { status: emailRes.status });
          }
        } catch (errSend) {
          logger.warn(`Falha ao despachar e-mail de alerta SLA para tenant ${tenantId}:`, { error: errSend.message });
        }
      }
    }

    return summary;
  }
});

/**
 * ── 2. EXPURGO E MANUTENÇÃO SEMANAL DO NEON POSTGRES (Domingo 04:00 UTC) ──
 * Otimiza o armazenamento e o egress do Neon eliminando telemetria e logs antigos (>30 dias).
 */
export const weeklyNeonMaintenance = schedules.task({
  id: "weekly-neon-maintenance",
  cron: "0 4 * * 0", // Domingo às 04:00 UTC (00:00 Boa Vista / 01:00 Brasília)
  run: async (payload) => {
    logger.info("Iniciando rotina de manutenção e otimização de egress no Neon Postgres");
    const sql = getDbClient();

    const result = {
      purgedClientErrors: 0,
      purgedExpiredTokens: 0,
      timestamp: new Date().toISOString()
    };

    // 1. Expurgar client_error_logs com mais de 30 dias
    try {
      const deletedLogs = await sql`
        DELETE FROM client_error_logs
        WHERE created_at < NOW() - INTERVAL '30 days'
        RETURNING id;
      `;
      result.purgedClientErrors = deletedLogs.length;
      logger.info(`Limpeza de logs de telemetria concluída: ${deletedLogs.length} registros expurgados.`);
    } catch (errLogs) {
      logger.warn("Aviso ao limpar client_error_logs:", { error: errLogs.message });
    }

    // 2. Expurgar sessões de auditoria antigas de login com mais de 90 dias se existir
    try {
      const deletedAudits = await sql`
        DELETE FROM audit_logs
        WHERE created_at < NOW() - INTERVAL '90 days'
          AND acao IN ('login_sucesso', 'heartbeat', 'consulta_leitura')
        RETURNING id;
      `;
      result.purgedOldAudits = deletedAudits.length;
      logger.info(`Limpeza de auditoria de rotina concluída: ${deletedAudits.length} registros expurgados.`);
    } catch (errAudit) {
      // Tabela pode ter schema diferente ou não ter essas ações
      logger.info("Auditoria de rotina pulada ou não necessária.");
    }

    return result;
  }
});

/**
 * ── 4. ROBÔ KEEP-ALIVE RENDER (A cada 10 minutos 24/7) ─────────────────────
 * Dispara requisições periódicas para o backend Render mantendo o processo ativo
 * e prevenindo o desligamento automático (sleep de 15 minutos) do plano gratuito.
 */
export const renderKeepAlive = schedules.task({
  id: "render-keep-alive",
  cron: "*/10 * * * *", // A cada 10 minutos
  run: async () => {
    const targetUrl = process.env.RENDER_HEALTH_URL || "https://finan-backend-9rxw.onrender.com/healthz";
    try {
      const res = await fetch(targetUrl, {
        headers: { "User-Agent": "FinGo-KeepAlive/1.0 (Trigger.dev Robot)" },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) {
        logger.warn("[Render Keep-Alive] Backend respondeu com erro HTTP.", { status: res.status });
        return { ok: false, status: res.status, url: targetUrl };
      }
      logger.info(`[Render Keep-Alive] Ping executado com status: ${res.status}`);
      return { ok: true, status: res.status, url: targetUrl };
    } catch (err) {
      logger.warn("[Render Keep-Alive] Aviso ao pingar Render:", { error: err.message });
      return { ok: false, error: err.message, url: targetUrl };
    }
  }
});

