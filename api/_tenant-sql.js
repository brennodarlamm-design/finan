// api/_tenant-sql.js — Contexto RLS por requisição usando transação HTTP do Neon
// Patch 56 / Fase B: prepara a aplicação para finobra_app + FORCE ROW LEVEL SECURITY.
//
// O driver HTTP do Neon não preserva estado de sessão entre queries. Por isso,
// app.current_tenant_id e app.is_system precisam ser definidos na MESMA transação
// da consulta que depende das políticas RLS.

function normalizeTenantId(value) {
  return String(value || '').trim().slice(0, 160);
}

function assertBaseSql(baseSql) {
  if (typeof baseSql !== 'function' || typeof baseSql.transaction !== 'function') {
    throw new TypeError('createTenantSql requer um cliente Neon SQL com suporte a transaction().');
  }
}

function normalizeContext({ tenantId, isSystem = false } = {}) {
  const normalizedTenantId = normalizeTenantId(tenantId);
  const system = isSystem === true;

  // Fail-closed: uma chamada normal nunca pode executar sem tenant resolvido.
  if (!system && !normalizedTenantId) {
    throw new Error('Contexto tenant obrigatório para acesso ao banco.');
  }

  return {
    tenantId: normalizedTenantId,
    isSystem: system,
    systemFlag: system ? 'true' : 'false'
  };
}

function isTemplateStrings(value) {
  return Array.isArray(value) && Array.isArray(value.raw);
}

/**
 * Retorna um tagged-template compatível com sql`...`.
 * Cada consulta é executada em uma transação contendo:
 *   1. set_config(app.current_tenant_id, ..., true)
 *   2. set_config(app.is_system, ..., true)
 *   3. a consulta do chamador
 *
 * O terceiro parâmetro true de set_config equivale a SET LOCAL: o valor morre
 * ao fim da transação e não vaza para outra requisição/tenant.
 */
export function createTenantSql(baseSql, context = {}) {
  assertBaseSql(baseSql);
  const ctx = normalizeContext(context);

  const scopedSql = async (strings, ...values) => {
    if (!isTemplateStrings(strings)) {
      throw new TypeError('Tenant SQL deve ser chamado como tagged template: sql`SELECT ...`.');
    }

    const results = await baseSql.transaction(txn => [
      txn`
        SELECT
          set_config('app.current_tenant_id', ${ctx.tenantId}, true) AS tenant_context,
          set_config('app.is_system', ${ctx.systemFlag}, true) AS system_context;
      `,
      txn(strings, ...values)
    ]);

    return results?.[1] ?? [];
  };

  /**
   * Para operações que já precisam ser atômicas, mantém o mesmo contexto em uma
   * única transação. O builder recebe o txn original do Neon e deve retornar um
   * array de queries Neon. O resultado da query de contexto é removido.
   */
  scopedSql.transaction = async (builder, options) => {
    if (typeof builder !== 'function') {
      throw new TypeError('tenantSql.transaction requer um builder function.');
    }

    const results = await baseSql.transaction(txn => {
      const userQueries = builder(txn);
      if (!Array.isArray(userQueries)) {
        throw new TypeError('tenantSql.transaction builder deve retornar um array de queries.');
      }

      return [
        txn`
          SELECT
            set_config('app.current_tenant_id', ${ctx.tenantId}, true) AS tenant_context,
            set_config('app.is_system', ${ctx.systemFlag}, true) AS system_context;
        `,
        ...userQueries
      ];
    }, options);

    return Array.isArray(results) ? results.slice(1) : [];
  };

  Object.defineProperties(scopedSql, {
    tenantId: { value: ctx.tenantId, enumerable: true },
    isSystem: { value: ctx.isSystem, enumerable: true },
    __tenantScoped: { value: true, enumerable: false }
  });

  return scopedSql;
}

export function isTenantScopedSql(sql) {
  return Boolean(sql && sql.__tenantScoped === true);
}
