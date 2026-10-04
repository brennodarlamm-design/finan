-- migration/023_update_superadmin_credentials.sql
-- Já aplicada em produção (registrada em schema_migrations como '023_update_superadmin_credentials.sql').
--
-- AUDITORIA 2026-10-04 #3: esta migração continha o hash da senha do superadmin, o que permitia
-- tentar descobrir a senha offline a partir do repositório. O conteúdo foi removido. Credenciais
-- nunca devem ser versionadas: para trocar a senha do Master use o fluxo "Esqueci a senha"
-- (exige o Google Authenticator) ou um UPDATE feito por uma pessoa direto no banco, sem commit.
SELECT 1;
