-- migrations/044_dfe_documentos_lancada.sql
-- NF-e capturadas pela SEFAZ ficam na lista do Monitor DF-e depois de lançadas, e alguém podia
-- lançar de novo. Guarda a marcação de "já lançada" (automática ao gerar a despesa ou manual,
-- para notas lançadas por fora). Só aditiva e idempotente.

ALTER TABLE tenant_dfe_documentos ADD COLUMN IF NOT EXISTS lancada_em TIMESTAMPTZ;
ALTER TABLE tenant_dfe_documentos ADD COLUMN IF NOT EXISTS lancada_por VARCHAR(100);
ALTER TABLE tenant_dfe_documentos ADD COLUMN IF NOT EXISTS lancada_manual BOOLEAN NOT NULL DEFAULT FALSE;
