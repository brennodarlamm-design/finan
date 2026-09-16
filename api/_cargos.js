// api/_cargos.js - Sanitizador de Cargos e Funcoes da Empresa (Patch 52)

/**
 * Sanitiza a lista de cargos antes de persistir em tenant_preferences.cargos
 */
export function sanitizeCargos(input) {
  if (!Array.isArray(input)) return [];
  const text = (v, max) => String(v ?? '').slice(0, max);
  const seen = new Set();

  return input.slice(0, 50).flatMap(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const id = text(raw.id, 80).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      nome:         text(raw.nome, 120),
      icone:        text(raw.icone, 8),
      cor:          /^#[0-9a-fA-F]{3,6}$/.test(String(raw.cor || '')) ? String(raw.cor) : null,
      usuario_id:   raw.usuario_id ? text(raw.usuario_id, 80) : null,
      usuario_nome: text(raw.usuario_nome || '', 255),
    }];
  });
}

/**
 * Sanitiza templates de workflow antes de persistir em tenant_preferences.workflow_templates
 */
export function sanitizeWorkflowTemplates(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const text = (v, max) => String(v ?? '').slice(0, max);
  const result = {};

  for (const [key, tmpl] of Object.entries(input).slice(0, 20)) {
    if (!tmpl || typeof tmpl !== 'object') continue;
    const safeKey = text(key, 80).replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeKey) continue;

    const processos = Array.isArray(tmpl.processos)
      ? tmpl.processos.slice(0, 100).flatMap(p => {
          if (!p || typeof p !== 'object') return [];
          const id = text(p.id, 80).replace(/[^a-zA-Z0-9_-]/g, '');
          if (!id) return [];
          return [{
            id,
            codigo:            text(p.codigo, 40),
            nome:              text(p.nome, 240),
            tipo:              text(p.tipo, 40),
            tipoLabel:         text(p.tipoLabel, 80),
            icone:             text(p.icone, 16),
            dias_sla:          Math.max(1, Math.min(365, Number.parseInt(p.dias_sla, 10) || 30)),
            predecessor_id:    p.predecessor_id ? text(p.predecessor_id, 80).replace(/[^a-zA-Z0-9_-]/g, '') : null,
            descricao:         text(p.descricao, 2000),
            cargo_responsavel: p.cargo_responsavel ? text(p.cargo_responsavel, 80).replace(/[^a-zA-Z0-9_-]/g, '') : null,
            checklist:         Array.isArray(p.checklist)
                                 ? p.checklist.slice(0, 20).map(i => text(String(i ?? ''), 200)).filter(Boolean)
                                 : [],
          }];
        })
      : [];

    result[safeKey] = {
      nome:     text(tmpl.nome, 120),
      icone:    text(tmpl.icone || '', 8),
      builtin:  Boolean(tmpl.builtin),
      processos,
    };
  }
  return result;
}
