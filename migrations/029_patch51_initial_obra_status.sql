-- PATCH 51 — Status inicial de Nova Obra
-- Criações de obra pelo usuário começam somente em Em Andamento ou Documentação.
-- O registro técnico "escritorio" permanece permitido com status sistema.

CREATE OR REPLACE FUNCTION finobra_validate_initial_obra_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS NULL OR BTRIM(NEW.status) = '' THEN
    NEW.status := 'em_andamento';
  END IF;

  IF NEW.status IN ('em_andamento', 'documentacao') THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'sistema' AND NEW.id = 'escritorio' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'INITIAL_OBRA_STATUS_NOT_ALLOWED: %', NEW.status
    USING ERRCODE = '23514';
END;
$$;

DROP TRIGGER IF EXISTS trg_finobra_initial_obra_status ON obras;
CREATE TRIGGER trg_finobra_initial_obra_status
BEFORE INSERT ON obras
FOR EACH ROW
EXECUTE FUNCTION finobra_validate_initial_obra_status();
