-- 047: NSUs que a SEFAZ já entregou a outro sistema (ou que foram pulados por uma rejeição 656) e
-- que o FinGo ainda precisa buscar um a um (consNSU). Sem isso as notas desses NSUs se perdiam.
ALTER TABLE tenant_dfe_sync ADD COLUMN IF NOT EXISTS nsu_lacunas text[] NOT NULL DEFAULT '{}';
