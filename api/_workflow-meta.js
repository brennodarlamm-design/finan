// PATCH 51 — Cadastro Geral complementar da obra.
// Multiplexado por /api/audit?action=workflow_meta_save para não criar nova função Vercel.
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { canAccessModule, canWriteData, permissionError } from './_permissions.js';
import { writeAudit } from './_audit.js';

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return neon(process.env.DATABASE_URL);
}

const cleanText = (value, max = 255) => String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
const cleanId = (value, max = 80) => cleanText(value, max).replace(/[^A-Za-z0-9_.:@-]/g, '');
const cleanDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;

export default async function workflowMetaHandler(req, res) {
  const auth = await resolveAuthAndTenant(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ success:false, error:auth.error || 'Acesso não autorizado.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ success:false, error:'Método não permitido.' });
  if (!canWriteData(auth) || !canAccessModule(auth, 'obras', 'write')) {
    return res.status(403).json(permissionError('MODULE_WRITE_FORBIDDEN', 'obras'));
  }

  const tenantId = auth.tenantId;
  const body = req.body || {};
  const meta = body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) ? body.meta : body;
  const obraId = cleanId(body.obraId || body.obra_id, 64);
  if (!obraId) return res.status(400).json({ success:false, code:'OBRA_REQUIRED', error:'Obra é obrigatória.' });

  const sql = getSql();
  try {
    const obraRows = await sql`SELECT id FROM obras WHERE tenant_id=${tenantId} AND id=${obraId} LIMIT 1;`;
    if (!obraRows.length) return res.status(404).json({ success:false, code:'OBRA_NOT_FOUND', error:'Obra não encontrada.' });

    const rtTipo = ['interno','externo'].includes(String(meta.responsavel_tecnico_tipo))
      ? String(meta.responsavel_tecnico_tipo)
      : 'externo';

    let rtUser = null;
    let rtNome = null;
    let rtRegistro = null;

    if (rtTipo === 'interno') {
      const userId = cleanId(meta.responsavel_tecnico_usuario_id, 64);
      if (!userId) {
        return res.status(400).json({ success:false, code:'INVALID_INTERNAL_RT', error:'Selecione o responsável técnico interno.' });
      }
      const users = await sql`
        SELECT id, nome, perfil
        FROM usuarios
        WHERE tenant_id=${tenantId} AND id=${userId} AND ativo=TRUE
        LIMIT 1;
      `;
      rtUser = users[0] || null;
      if (!rtUser) {
        return res.status(400).json({ success:false, code:'INVALID_INTERNAL_RT', error:'O responsável técnico interno precisa ser um usuário ativo desta empresa.' });
      }
      // O cadastro atual de usuários separa perfil de acesso (admin/gestor/operador)
      // da função profissional. Por isso a segurança aqui valida vínculo + usuário ativo,
      // sem confundir perfil de acesso com profissão de engenheiro/arquiteto.
      rtNome = rtUser.nome;
      rtRegistro = null;
    } else {
      rtNome = cleanText(meta.responsavel_tecnico_nome, 255) || null;
      rtRegistro = cleanText(meta.responsavel_tecnico_registro, 120) || null;
      if (!rtNome || !rtRegistro) {
        return res.status(400).json({ success:false, code:'INVALID_EXTERNAL_RT', error:'Informe o nome e o CREA/CAU do responsável técnico externo.' });
      }
    }

    const saved = await sql`
      INSERT INTO obra_cadastro_geral (
        tenant_id, obra_id, rg, orgao_expedidor, data_nascimento,
        responsavel_tecnico_tipo, responsavel_tecnico_usuario_id,
        responsavel_tecnico_nome, responsavel_tecnico_registro,
        subtitulo_capa, payload, updated_at
      ) VALUES (
        ${tenantId}, ${obraId}, ${cleanText(meta.rg,64) || null},
        ${cleanText(meta.orgao_expedidor,64) || null}, ${cleanDate(meta.data_nascimento)},
        ${rtTipo}, ${rtUser?.id || null}, ${rtNome}, ${rtRegistro},
        ${cleanText(meta.subtitulo_capa,255) || null}, '{}'::jsonb, NOW()
      )
      ON CONFLICT (tenant_id, obra_id) DO UPDATE SET
        rg=EXCLUDED.rg,
        orgao_expedidor=EXCLUDED.orgao_expedidor,
        data_nascimento=EXCLUDED.data_nascimento,
        responsavel_tecnico_tipo=EXCLUDED.responsavel_tecnico_tipo,
        responsavel_tecnico_usuario_id=EXCLUDED.responsavel_tecnico_usuario_id,
        responsavel_tecnico_nome=EXCLUDED.responsavel_tecnico_nome,
        responsavel_tecnico_registro=EXCLUDED.responsavel_tecnico_registro,
        subtitulo_capa=EXCLUDED.subtitulo_capa,
        payload='{}'::jsonb,
        updated_at=NOW()
      RETURNING *;
    `;

    await writeAudit(sql, req, auth, {
      acao:'salvar',
      entidade:'obra_cadastro_geral',
      entidadeId:obraId,
      // Não grava RG/data de nascimento em log de auditoria.
      depois:{ responsavel_tecnico_tipo:rtTipo, responsavel_tecnico_usuario_id:rtUser?.id || null, subtitulo_capa:!!saved[0]?.subtitulo_capa }
    });

    return res.status(200).json({ success:true, meta:saved[0] });
  } catch (err) {
    console.error('[Patch51 Meta]', err);
    if (/relation .* does not exist|column .* does not exist/i.test(String(err?.message || ''))) {
      return res.status(503).json({ success:false, code:'PATCH51_SCHEMA_NOT_READY', error:'A estrutura do Patch 51 ainda não foi aplicada neste ambiente.' });
    }
    return res.status(500).json({ success:false, code:'WORKFLOW_META_ERROR', error:'Não foi possível salvar o Cadastro Geral agora.' });
  }
}
