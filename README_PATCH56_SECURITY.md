# Patch 56 — Security Hardening

Status: desenvolvimento em branch isolada. Não aplicar migration 030 nem fazer merge em produção sem validar os segredos dedicados e o rollout do banco.

## Implementado

- Rate limit distribuído existente integrado ao bloqueio por IP.
- Fail2Ban lógico serverless com score e bans progressivos (5 min, 30 min, 6 h, 24 h).
- IP normalizado e indexado via HMAC-SHA256 com `IP_BAN_PEPPER`; tabela de banimento não persiste IP em texto puro.
- Cobertura para login, MFA, Google OAuth, cadastro e solicitação de reset.
- Auditoria de senha inválida e MFA inválido alimenta o score de abuso.
- Allowlist administrativa preparada sem bypass de autenticação/RBAC.
- `TENANT_KEY_PEPPER` e `MFA_ENCRYPTION_KEY` sem fallback hardcoded; produção falha fechado sem segredo dedicado.
- Migrador MFA legado é dry-run por padrão e exige `--apply`.
- Migration 030 cria `security_ip_state`, `security_ip_events` e `security_ip_allowlist`.
- Testes do Patch 56 integrados à suíte de regressão.

## Antes do merge em produção

1. Configurar segredos dedicados com alta entropia em Production:
   - `MFA_ENCRYPTION_KEY`
   - `TENANT_KEY_PEPPER`
   - `IP_BAN_PEPPER`
2. Executar o migrador MFA em dry-run e validar o resultado.
3. Aplicar a migration 030 em ambiente de banco isolado; a criação automática de branch Neon está bloqueada no momento pelo limite de branches.
4. Só depois aplicar migration 030 em produção.
5. Confirmar login tenant, login Master + MFA, Google OAuth, reset e rate limits.

## Fase seguinte

- criar role `finobra_app` sem `BYPASSRLS`;
- conceder somente privilégios necessários;
- validar contexto tenant em todas as rotas;
- migrar runtime para `finobra_app`;
- aplicar `FORCE ROW LEVEL SECURITY` somente após validação;
- desativar Neon Data API se continuar sem uso;
- proteger `main` com CI/security regression obrigatórios;
- integrar bans graves à Cloudflare Edge/WAF.
