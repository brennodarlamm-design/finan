-- migrations/040_document_signatures_sem_leitura_publica.sql
-- AUDITORIA 2026-10-04 #12: a política "signatures_public_read" (USING codigo_validacao IS NOT NULL)
-- é permissiva e se soma (OR) ao isolamento por empresa: qualquer conexão da aplicação lia nome,
-- documento e IP de quem assinou em TODAS as empresas. A validação pública por código passa a usar
-- funções SECURITY DEFINER que devolvem só o registro daquele código.

BEGIN;

DROP POLICY IF EXISTS signatures_public_read ON document_signatures;

-- Validação pública (página /validar e QR Code): um registro, pelo código exato.
CREATE OR REPLACE FUNCTION validar_assinatura_publica(p_codigo text)
RETURNS TABLE (
  codigo_validacao text, hash_sha256 text, nome text, doc text, papel text,
  doc_tipo text, doc_id text, doc_numero text, data_hora timestamptz, data_hora_fmt text,
  ip_dispositivo text, created_at timestamptz,
  nome_fantasia text, razao_social text, cnpj text, cidade text, uf text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.codigo_validacao::text, s.hash_sha256::text, s.nome::text, s.doc::text, s.papel::text,
         s.doc_tipo::text, s.doc_id::text, s.doc_numero::text, s.data_hora, s.data_hora_fmt::text,
         s.ip_dispositivo::text, s.created_at,
         t.nome_fantasia::text, t.razao_social::text, t.cnpj::text, t.cidade::text, t.uf::text
  FROM document_signatures s
  JOIN tenants t ON t.id = s.tenant_id
  WHERE length(coalesce(p_codigo, '')) BETWEEN 8 AND 80
    AND UPPER(s.codigo_validacao) = UPPER(p_codigo)
  LIMIT 1;
$$;

-- Ao registrar uma assinatura: o código já existe? Responde sem revelar dados de outra empresa.
--   'livre' | 'mesmo_registro' (mesma empresa e mesmo hash) | 'em_uso'
CREATE OR REPLACE FUNCTION codigo_assinatura_status(p_codigo text, p_tenant text, p_hash text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE WHEN s.tenant_id = p_tenant AND lower(s.hash_sha256) = lower(p_hash) THEN 'mesmo_registro' ELSE 'em_uso' END
    FROM document_signatures s WHERE s.codigo_validacao = p_codigo LIMIT 1
  ), 'livre');
$$;

REVOKE ALL ON FUNCTION validar_assinatura_publica(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION codigo_assinatura_status(text, text, text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'finobra_app') THEN
    GRANT EXECUTE ON FUNCTION validar_assinatura_publica(text) TO finobra_app;
    GRANT EXECUTE ON FUNCTION codigo_assinatura_status(text, text, text) TO finobra_app;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'schema_migrations') THEN
    INSERT INTO schema_migrations (version, applied_at, checksum, execution_time_ms)
    VALUES ('040_document_signatures_sem_leitura_publica.sql', CURRENT_TIMESTAMP, 'auditoria_2026_10_04_item12', 0)
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

COMMIT;
