import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('Aplicando Migration 023: Atualizando credenciais do superadmin...');

  await sql`
    UPDATE usuarios
    SET
      username   = 'adhomem@',
      email      = 'adhomem@',
      senha_hash = '831f2ac22a102b9c1745b778f9373094:9fcdf3f185623f5a3f7185b6ccca758bc71ecfddeeef7b403e09e2a60c901c1b52f402eeb2c5532afbd971af5b3fe5f22873a12f0050f9a291c38985f51a0e4d',
      mfa_enabled = FALSE,
      mfa_secret  = NULL,
      mfa_backup_codes = '[]'::jsonb,
      mfa_last_used_step = 0
    WHERE perfil = 'superadmin';
  `;
  console.log('Credenciais do superadmin atualizadas com sucesso!');

  await sql`
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('023_update_superadmin_credentials.sql', CURRENT_TIMESTAMP, 'patch50_superadmin_creds', 0)
    ON CONFLICT (version) DO NOTHING;
  `;
  console.log('Registro gravado em schema_migrations');

  const result = await sql`SELECT id, username, email, perfil, mfa_enabled FROM usuarios WHERE perfil = 'superadmin' LIMIT 1;`;
  console.table(result);
  console.log('PRONTO! Novo login: adhomem@');
}

run().catch(err => {
  console.error('Erro na migracao 023:', err);
  process.exit(1);
});
