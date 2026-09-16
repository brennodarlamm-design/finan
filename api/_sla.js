// Campos aceitos para templates da empresa e processos de uma obra.
export function sanitizeSlaProcesses(input) {
  if (!Array.isArray(input)) return [];
  const text = (value, max) => String(value ?? '').slice(0, max);
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && Number.isFinite(Date.parse(value)) ? String(value) : '';
  const seen = new Set();
  return input.slice(0, 100).flatMap(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const id = text(raw.id, 80).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{
      id, nome:text(raw.nome, 240), codigo:text(raw.codigo, 40),
      tipo:text(raw.tipo, 40), tipoLabel:text(raw.tipoLabel, 80), icone:text(raw.icone, 16),
      dias_sla:Math.max(1, Math.min(365, Number.parseInt(raw.dias_sla, 10) || 30)),
      predecessor_id:raw.predecessor_id ? text(raw.predecessor_id, 80).replace(/[^a-zA-Z0-9_-]/g, '') : null,
      descricao:text(raw.descricao, 2000), observacoes:text(raw.observacoes, 4000),
      status:['pendente','em_andamento','concluido'].includes(raw.status) ? raw.status : 'pendente',
      percentual:Math.max(0, Math.min(100, Number(raw.percentual) || 0)),
      data_inicio_real:date(raw.data_inicio_real), data_fim_real:date(raw.data_fim_real),
      cargo_responsavel:text(raw.cargo_responsavel, 100),
      responsavel_usuario_id:raw.responsavel_usuario_id ? text(raw.responsavel_usuario_id, 80).replace(/[^a-zA-Z0-9_-]/g, '') : null,
      motivo_atraso:text(raw.motivo_atraso, 100),
      motivo_atraso_detalhe:text(raw.motivo_atraso_detalhe, 500),
      checklist_status:text(raw.checklist_status, 40),
      transferida_em:date(raw.transferida_em),
      checklist:Array.isArray(raw.checklist) ? raw.checklist.slice(0, 50).map(item => (typeof item === 'object' && item !== null ? {id:text(item.id, 40), descricao:text(item.descricao || item.texto, 255), concluido:!!item.concluido} : text(item, 255))) : [],
      historico:Array.isArray(raw.historico) ? raw.historico.slice(0, 50).flatMap(h => {
        if (!h || typeof h !== 'object') return [];
        return [{
          data: text(h.data, 30),
          autor: text(h.autor, 120),
          de_status: text(h.de_status || h.status_anterior, 40),
          para_status: text(h.para_status || h.status_novo, 40),
          texto: text(h.texto || h.comentario, 1000),
          motivo: text(h.motivo, 100)
        }];
      }) : []
    }];
  });
}

/**
 * Envelope padronizado de resposta RESTful (Skill: api-design-principles)
 */
export function formatApiResponse(data, { success = true, meta = null } = {}) {
  const payload = {
    success: Boolean(success),
    data: data ?? null,
    timestamp: new Date().toISOString()
  };
  if (meta && typeof meta === 'object') {
    payload.meta = meta;
  }
  return payload;
}

/**
 * Envelope padronizado de erro RESTful (Skill: api-design-principles)
 */
export function formatApiError(message, { code = 'BAD_REQUEST', status = 400 } = {}) {
  return {
    success: false,
    error: String(message || 'Erro inesperado'),
    code: String(code),
    status: Number(status) || 400,
    timestamp: new Date().toISOString()
  };
}

/**
 * Projeta processos com egress otimizado, omitindo logs extensos quando não solicitados (Skill: neon-postgres-egress-optimizer)
 */
export function projectSlaSummary(processos, { includeHistorico = false, maxHistorico = 10 } = {}) {
  if (!Array.isArray(processos)) return [];
  return processos.map(p => {
    const proj = {
      id: p.id,
      nome: p.nome,
      codigo: p.codigo,
      tipo: p.tipo,
      tipoLabel: p.tipoLabel,
      icone: p.icone,
      dias_sla: p.dias_sla,
      predecessor_id: p.predecessor_id,
      status: p.status,
      percentual: p.percentual,
      data_inicio_real: p.data_inicio_real,
      data_fim_real: p.data_fim_real,
      cargo_responsavel: p.cargo_responsavel,
      responsavel_usuario_id: p.responsavel_usuario_id,
      motivo_atraso: p.motivo_atraso,
      total_checklist: Array.isArray(p.checklist) ? p.checklist.length : 0,
      total_historico: Array.isArray(p.historico) ? p.historico.length : 0
    };
    if (includeHistorico && Array.isArray(p.historico)) {
      proj.historico = p.historico.slice(0, maxHistorico);
    }
    return proj;
  });
}

