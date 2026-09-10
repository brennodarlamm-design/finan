-- Patch 03 — Registro central e validação pública real de assinaturas
CREATE TABLE IF NOT EXISTS document_signatures (
  id VARCHAR(80) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id VARCHAR(64) REFERENCES usuarios(id) ON DELETE SET NULL,
  codigo_validacao VARCHAR(80) NOT NULL UNIQUE,
  hash_sha256 VARCHAR(128) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  doc VARCHAR(64),
  papel VARCHAR(120),
  doc_tipo VARCHAR(50) DEFAULT 'documento',
  doc_id VARCHAR(64),
  doc_numero VARCHAR(100),
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  data_hora_fmt VARCHAR(100),
  ip_dispositivo VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_document_signatures_tenant_created
  ON document_signatures (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_signatures_doc
  ON document_signatures (tenant_id, doc_tipo, doc_id);
