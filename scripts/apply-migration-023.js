// scripts/apply-migration-023.js — DESATIVADO.
//
// AUDITORIA 2026-10-04 #3: este script gravava uma senha fixa (hash versionado no Git) no
// superadmin e DESLIGAVA o MFA dele. Rodá-lo de novo devolveria a conta Master a uma senha
// conhecida e sem autenticador. A migração 023 já está aplicada em produção.
// Para trocar a senha do Master, use "Esqueci a senha" (exige o Google Authenticator).
console.error('apply-migration-023 está desativado por segurança (ver docs/AUDITORIA_2026-10-04.md, item 3).');
process.exit(1);
