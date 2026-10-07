-- migrations/046_dados_campos_sem_coluna.sql
-- Varredura de 07/10: campos que o app grava e usa mas não tinham coluna sumiam na sincronização.
--   lancamentos: origem, competência, vínculos com medição/pré-compra, parcela da NF-e...
--     (fornecedor_id já tinha coluna, mas a gravação não a preenchia — corrigido no código)
--   fornecedores: pessoa física/CPF, número, bairro, CEP, IE, contato, prazo, observações
--   orcamentos: controle das despesas já geradas (evita lançar duas vezes), anexos, datas
--   documentos: links externos (Drive/OneDrive), dados das pendências do BIM
--   produtos: fornecedor principal
--   tenants: CEP da empresa
-- Só aditiva e idempotente.

ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS dados JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE fornecedores ADD COLUMN IF NOT EXISTS dados JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS dados JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS dados JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS dados JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cep VARCHAR(10);
