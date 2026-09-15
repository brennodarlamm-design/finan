-- PATCH 51 — Workflow de obras, cadastro geral complementar, CUB e cláusulas versionadas
-- Aplicar primeiro em branch Neon de homologação. Não aplicar em produção sem aprovação explícita.

CREATE TABLE IF NOT EXISTS obra_cadastro_geral (
    tenant_id VARCHAR(64) NOT NULL,
    obra_id VARCHAR(64) NOT NULL,
    rg VARCHAR(64),
    orgao_expedidor VARCHAR(64),
    data_nascimento DATE,
    responsavel_tecnico_tipo VARCHAR(16) NOT NULL DEFAULT 'externo'
      CHECK (responsavel_tecnico_tipo IN ('interno','externo')),
    responsavel_tecnico_usuario_id VARCHAR(64),
    responsavel_tecnico_nome VARCHAR(255),
    responsavel_tecnico_registro VARCHAR(120),
    subtitulo_capa VARCHAR(255),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, obra_id),
    CONSTRAINT fk_obra_cadastro_obra
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_obra_cadastro_rt_usuario
      FOREIGN KEY (responsavel_tecnico_usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_obra_cadastro_rt_usuario
  ON obra_cadastro_geral (tenant_id, responsavel_tecnico_usuario_id);

CREATE TABLE IF NOT EXISTS workflow_etapas (
    tenant_id VARCHAR(64) NOT NULL,
    obra_id VARCHAR(64) NOT NULL,
    etapa_id VARCHAR(80) NOT NULL,
    ordem INTEGER NOT NULL CHECK (ordem >= 0),
    codigo VARCHAR(40),
    nome VARCHAR(240) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(40),
    tipo_label VARCHAR(80),
    icone VARCHAR(24),
    dias_sla INTEGER NOT NULL DEFAULT 1 CHECK (dias_sla BETWEEN 1 AND 365),
    status VARCHAR(24) NOT NULL DEFAULT 'pendente'
      CHECK (status IN ('pendente','em_andamento','concluido','bloqueado')),
    responsavel_user_id VARCHAR(64),
    responsavel_nome VARCHAR(255),
    responsavel_perfil VARCHAR(64),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by VARCHAR(64),
    observacoes TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, obra_id, etapa_id),
    CONSTRAINT uq_workflow_etapa_ordem UNIQUE (tenant_id, obra_id, ordem),
    CONSTRAINT fk_workflow_obra
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_responsavel
      FOREIGN KEY (responsavel_user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_workflow_completed_by
      FOREIGN KEY (completed_by) REFERENCES usuarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_my_tasks
  ON workflow_etapas (tenant_id, responsavel_user_id, status, ordem);
CREATE INDEX IF NOT EXISTS idx_workflow_obra_status
  ON workflow_etapas (tenant_id, obra_id, status, ordem);

CREATE TABLE IF NOT EXISTS workflow_historico (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    obra_id VARCHAR(64) NOT NULL,
    etapa_id VARCHAR(80) NOT NULL,
    evento VARCHAR(40) NOT NULL,
    actor_user_id VARCHAR(64),
    responsavel_user_id VARCHAR(64),
    detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_workflow_hist_obra
      FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_hist_obra
  ON workflow_historico (tenant_id, obra_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_patch51_settings (
    tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    cub_modo VARCHAR(16) NOT NULL DEFAULT 'fixo' CHECK (cub_modo IN ('fixo','volante')),
    cub_valor NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (cub_valor >= 0),
    cub_referencia DATE,
    cub_uf VARCHAR(2),
    contract_clauses JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_clause_versions (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    versao INTEGER NOT NULL,
    clauses JSONB NOT NULL,
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, versao)
);

CREATE INDEX IF NOT EXISTS idx_clause_versions_tenant
  ON contract_clause_versions (tenant_id, versao DESC);

-- Regra de negócio: depois que uma etapa existe, o SLA só pode aumentar.
CREATE OR REPLACE FUNCTION finobra_enforce_sla_increase_only()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.dias_sla < OLD.dias_sla THEN
    RAISE EXCEPTION 'SLA_DECREASE_NOT_ALLOWED: prazo só pode ser aumentado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_sla_increase_only ON workflow_etapas;
CREATE TRIGGER trg_workflow_sla_increase_only
BEFORE UPDATE OF dias_sla ON workflow_etapas
FOR EACH ROW
EXECUTE FUNCTION finobra_enforce_sla_increase_only();

-- Conclusão atômica: fecha a etapa atual e entrega a próxima ao responsável.
CREATE OR REPLACE FUNCTION finobra_complete_workflow_stage(
  p_tenant_id VARCHAR,
  p_obra_id VARCHAR,
  p_etapa_id VARCHAR,
  p_actor_user_id VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current workflow_etapas%ROWTYPE;
  v_next workflow_etapas%ROWTYPE;
BEGIN
  SELECT * INTO v_current
  FROM workflow_etapas
  WHERE tenant_id = p_tenant_id
    AND obra_id = p_obra_id
    AND etapa_id = p_etapa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORKFLOW_STAGE_NOT_FOUND';
  END IF;

  IF v_current.status = 'concluido' THEN
    SELECT * INTO v_next
    FROM workflow_etapas
    WHERE tenant_id = p_tenant_id
      AND obra_id = p_obra_id
      AND ordem > v_current.ordem
    ORDER BY ordem ASC
    LIMIT 1;

    RETURN jsonb_build_object(
      'already_completed', true,
      'completed_stage', v_current.etapa_id,
      'next_stage', CASE WHEN v_next.etapa_id IS NULL THEN NULL ELSE to_jsonb(v_next) END
    );
  END IF;

  IF v_current.status NOT IN ('em_andamento','bloqueado') THEN
    RAISE EXCEPTION 'WORKFLOW_STAGE_NOT_ACTIVE';
  END IF;

  UPDATE workflow_etapas
  SET status = 'concluido',
      completed_at = NOW(),
      completed_by = p_actor_user_id,
      updated_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND obra_id = p_obra_id
    AND etapa_id = p_etapa_id;

  INSERT INTO workflow_historico (
    tenant_id, obra_id, etapa_id, evento, actor_user_id, responsavel_user_id, detalhes
  ) VALUES (
    p_tenant_id, p_obra_id, p_etapa_id, 'concluida', p_actor_user_id,
    v_current.responsavel_user_id,
    jsonb_build_object('ordem', v_current.ordem, 'nome', v_current.nome)
  );

  SELECT * INTO v_next
  FROM workflow_etapas
  WHERE tenant_id = p_tenant_id
    AND obra_id = p_obra_id
    AND ordem > v_current.ordem
  ORDER BY ordem ASC
  LIMIT 1
  FOR UPDATE;

  IF v_next.etapa_id IS NOT NULL THEN
    UPDATE workflow_etapas
    SET status = 'em_andamento',
        started_at = COALESCE(started_at, NOW()),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND obra_id = p_obra_id
      AND etapa_id = v_next.etapa_id
      AND status = 'pendente';

    INSERT INTO workflow_historico (
      tenant_id, obra_id, etapa_id, evento, actor_user_id, responsavel_user_id, detalhes
    ) VALUES (
      p_tenant_id, p_obra_id, v_next.etapa_id, 'atribuida', p_actor_user_id,
      v_next.responsavel_user_id,
      jsonb_build_object('ordem', v_next.ordem, 'nome', v_next.nome)
    );

    SELECT * INTO v_next
    FROM workflow_etapas
    WHERE tenant_id = p_tenant_id
      AND obra_id = p_obra_id
      AND etapa_id = v_next.etapa_id;
  END IF;

  RETURN jsonb_build_object(
    'already_completed', false,
    'completed_stage', p_etapa_id,
    'next_stage', CASE WHEN v_next.etapa_id IS NULL THEN NULL ELSE to_jsonb(v_next) END
  );
END;
$$;
