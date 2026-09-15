-- migration/023_update_superadmin_credentials.sql
-- Atualiza credenciais do superadmin
UPDATE usuarios
SET
  username   = 'adhomem@',
  email      = 'adhomem@',
  senha_hash = '831f2ac22a102b9c1745b778f9373094:9fcdf3f185623f5a3f7185b6ccca758bc71ecfddeeef7b403e09e2a60c901c1b52f402eeb2c5532afbd971af5b3fe5f22873a12f0050f9a291c38985f51a0e4d'
WHERE perfil = 'superadmin';
