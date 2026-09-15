// Campos aceitos para templates da empresa e processos de uma obra.
export function sanitizeSlaProcesses(input) {
  if (!Array.isArray(input)) return [];
  const text = (value, max) => String(value ?? '').slice(0, max);
  const cleanId = (value, max = 80) => text(value, max).replace(/[^a-zA-Z0-9_.:@-]/g, '');
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && Number.isFinite(Date.parse(value)) ? String(value) : '';
  const seen = new Set();
  return input.slice(0, 100).flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const id = cleanId(raw.id, 80);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{
      id, nome:text(raw.nome, 240), codigo:text(raw.codigo, 40),
      tipo:text(raw.tipo, 40), tipoLabel:text(raw.tipoLabel, 80), icone:text(raw.icone, 16),
      dias_sla:Math.max(1, Math.min(365, Number.parseInt(raw.dias_sla, 10) || 30)),
      predecessor_id:raw.predecessor_id ? cleanId(raw.predecessor_id, 80) : null,
      descricao:text(raw.descricao, 2000), observacoes:text(raw.observacoes, 4000),
      status:['pendente','em_andamento','concluido','bloqueado'].includes(raw.status) ? raw.status : 'pendente',
      percentual:Math.max(0, Math.min(100, Number(raw.percentual) || 0)),
      data_inicio_real:date(raw.data_inicio_real), data_fim_real:date(raw.data_fim_real),
      // Patch 51: o template de SLA também define quem recebe cada etapa do workflow.
      responsavel_user_id:raw.responsavel_user_id ? cleanId(raw.responsavel_user_id, 64) : null,
      responsavel_nome:text(raw.responsavel_nome, 255),
      responsavel_perfil:text(raw.responsavel_perfil, 64),
      ordem:Math.max(0, Math.min(999, Number.parseInt(raw.ordem, 10) || index))
    }];
  });
}
