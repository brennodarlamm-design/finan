// api/tenant.js — Dados cadastrais da empresa autenticada
import { neon } from '@neondatabase/serverless';
import { resolveAuthAndTenant } from './_auth.js';
import { writeAudit } from './_audit.js';
import { canManageTenant, permissionError } from './_permissions.js';

function getSql(){ if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.'); return neon(process.env.DATABASE_URL); }
function cors(req,res){
  const allowed=['https://finobra.app.br','https://www.finobra.app.br','http://localhost:3000','http://localhost:3333','http://localhost:5000','http://127.0.0.1:3000','http://127.0.0.1:3333','http://127.0.0.1:5000'];
  const o=req.headers.origin; if(o&&(allowed.includes(o)||o.endsWith('.vercel.app'))) res.setHeader('Access-Control-Allow-Origin',o);
  res.setHeader('Access-Control-Allow-Credentials','true'); res.setHeader('Access-Control-Allow-Methods','GET,PATCH,OPTIONS'); res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization, x-tenant-id');
}
const pick=t=>({id:t.id,razao_social:t.razao_social||'',nome_fantasia:t.nome_fantasia||'',cnpj:t.cnpj||'',telefone:t.telefone||'',email:t.email||'',cidade:t.cidade||'',uf:t.uf||'',endereco:t.endereco||'',responsavel:t.responsavel||'',logo_url:t.logo_url||'',crea_cau:t.crea_cau||'',plano:t.plano||'trial',status:t.status||'trial',created_at:t.created_at});

export default async function handler(req,res){
  cors(req,res); if(req.method==='OPTIONS') return res.status(200).end();
  const auth=await resolveAuthAndTenant(req); if(!auth.authenticated) return res.status(auth.status||401).json({success:false,error:auth.error});
  const sql=getSql();
  try{
    const rows=await sql`SELECT * FROM tenants WHERE id=${auth.tenantId} LIMIT 1;`;
    if(!rows.length) return res.status(404).json({success:false,error:'Empresa não encontrada.'});
    if(req.method==='GET') return res.status(200).json({success:true,tenant:pick(rows[0])});
    if(req.method==='PATCH'){
      if(!canManageTenant(auth)) return res.status(403).json(permissionError('ROLE_MANAGE_TENANT_FORBIDDEN'));
      const b=req.body||{};
      const before=pick(rows[0]);
      const nome=String(b.nome_fantasia??before.nome_fantasia).trim();
      const razao=String(b.razao_social??before.razao_social??nome).trim();
      if(!nome) return res.status(400).json({success:false,error:'Nome fantasia é obrigatório.'});
      const uf=String(b.uf??before.uf).trim().toUpperCase().slice(0,2);
      const updated=await sql`
        UPDATE tenants SET
          nome_fantasia=${nome}, razao_social=${razao||nome}, cnpj=${String(b.cnpj??before.cnpj).trim()||null},
          telefone=${String(b.telefone??before.telefone).trim()||null}, email=${String(b.email??before.email).trim().toLowerCase()||null},
          cidade=${String(b.cidade??before.cidade).trim()||null}, uf=${uf||null}, endereco=${String(b.endereco??before.endereco).trim()||null},
          responsavel=${String(b.responsavel??before.responsavel).trim()||null}, logo_url=${String(b.logo_url??before.logo_url).trim()||null},
          crea_cau=${String(b.crea_cau??before.crea_cau).trim()||null}, updated_at=NOW()
        WHERE id=${auth.tenantId}
        RETURNING *;
      `;
      const after=pick(updated[0]);
      await writeAudit(sql,req,auth,{acao:'atualizar',entidade:'tenant',entidadeId:auth.tenantId,antes:before,depois:after});
      return res.status(200).json({success:true,tenant:after});
    }
    return res.status(405).json({success:false,error:'Método não permitido.'});
  }catch(err){ console.error('[Tenant API]',err); return res.status(500).json({success:false,error:'Erro interno ao atualizar a empresa.'}); }
}
