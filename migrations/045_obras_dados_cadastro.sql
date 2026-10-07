-- migrations/045_obras_dados_cadastro.sql
-- Cadastro completo da obra: modalidade, valor financiado, entrada, área, CPF/CNPJ, cidade/UF,
-- contrato Caixa, telefone, responsável etc. não tinham coluna e nunca chegavam ao banco (ficavam
-- só no navegador e sumiam na sincronização). Só aditiva e idempotente.

ALTER TABLE obras ADD COLUMN IF NOT EXISTS dados JSONB NOT NULL DEFAULT '{}'::jsonb;
