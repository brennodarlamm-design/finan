// scripts/decrypt-r2-backup.mjs — decifra um snapshot diário do R2 (formato FGBK1).
//
// Uso (PowerShell):
//   $env:BACKUP_ENCRYPTION_KEY = "<a mesma chave configurada no Worker>"
//   npx wrangler r2 object get fingo-backups/backups/neon-critical/2026-10-03/snapshot.json.enc --file snapshot.json.enc --remote
//   node scripts/decrypt-r2-backup.mjs snapshot.json.enc snapshot.json
//
// O arquivo decifrado contém dados de TODOS os tenants (inclusive usuários).
// Guarde-o fora do repositório e apague-o assim que terminar a restauração.
import fs from 'fs';
import { decryptBackupPayload } from '../api/_edge-backup.js';

const [input, output] = process.argv.slice(2);
const secret = String(process.env.BACKUP_ENCRYPTION_KEY || '').trim();

if (!input || !output) {
  console.error('Uso: node scripts/decrypt-r2-backup.mjs <entrada.enc> <saida.json>');
  process.exit(1);
}
if (secret.length < 32) {
  console.error('Defina BACKUP_ENCRYPTION_KEY (mín. 32 caracteres) no ambiente antes de executar.');
  process.exit(1);
}

const plain = await decryptBackupPayload(fs.readFileSync(input), secret);
fs.writeFileSync(output, plain);
const parsed = JSON.parse(new TextDecoder().decode(plain));
const counts = Object.fromEntries(Object.entries(parsed.tables || {}).map(([t, v]) => [t, v.count]));
console.log(`✅ Backup ${parsed.date} decifrado em ${output}`);
console.log(counts);
