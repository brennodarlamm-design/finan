// api/_edge-metrics.js — Coletor de Métricas, Observabilidade e Dashboard de Telemetria no Edge
// Agrega latências (P50/P95/P99), status HTTP, taxa de cache e bloqueios de segurança em tempo real.

const metrics = {
  totalRequests: 0,
  statusCodes: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  cacheHits: 0,
  cacheMisses: 0,
  securityBlocks: 0,
  latencies: [], // Amostra circular de até 500 tempos de resposta
  startedAt: new Date().toISOString()
};

/**
 * Registra a execução de uma requisição no coletor de métricas.
 */
export function recordEdgeMetric(entry = {}) {
  const { status = 200, latencyMs = 1, isCacheHit = false, isSecurityBlock = false } = entry;

  metrics.totalRequests++;

  const statusGroup = `${Math.floor(status / 100)}xx`;
  if (metrics.statusCodes[statusGroup] !== undefined) {
    metrics.statusCodes[statusGroup]++;
  }

  if (isCacheHit) {
    metrics.cacheHits++;
  } else {
    metrics.cacheMisses++;
  }

  if (isSecurityBlock) {
    metrics.securityBlocks++;
  }

  metrics.latencies.push(Math.max(1, Number(latencyMs) || 1));
  if (metrics.latencies.length > 500) {
    metrics.latencies.shift();
  }
}

/**
 * Calcula percentis P50, P95 e P99 a partir da amostra de latências.
 */
function calculatePercentiles(latencies) {
  if (!latencies.length) return { p50: 0, p95: 0, p99: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = Number((sorted.reduce((s, v) => s + v, 0) / sorted.length).toFixed(1));
  const p50 = sorted[Math.floor(sorted.length * 0.50)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  return { p50, p95, p99, avg };
}

/**
 * Retorna o resumo consolidado de observabilidade da borda.
 */
export function getEdgeMetricsSummary() {
  const percentiles = calculatePercentiles(metrics.latencies);
  const totalCache = metrics.cacheHits + metrics.cacheMisses;
  const cacheHitRate = totalCache > 0 ? Number(((metrics.cacheHits / totalCache) * 100).toFixed(1)) : 0;
  const errorRate = metrics.totalRequests > 0 ? Number(((metrics.statusCodes['5xx'] / metrics.totalRequests) * 100).toFixed(2)) : 0;

  return {
    uptimeStartedAt: metrics.startedAt,
    totalRequests: metrics.totalRequests,
    statusCodes: metrics.statusCodes,
    errorRate: `${errorRate}%`,
    cache: {
      hits: metrics.cacheHits,
      misses: metrics.cacheMisses,
      hitRate: `${cacheHitRate}%`
    },
    latency: {
      p50: `${percentiles.p50}ms`,
      p95: `${percentiles.p95}ms`,
      p99: `${percentiles.p99}ms`,
      avg: `${percentiles.avg}ms`
    },
    security: {
      blockedRequests: metrics.securityBlocks
    },
    edgeRegions: ['GRU (São Paulo)', 'GIG (Rio de Janeiro)', 'BSB (Brasília)', 'FOR (Fortaleza)']
  };
}

/**
 * Renderiza o painel visual dark mode em HTML para a rota /__edge/metrics.
 */
export function renderEdgeMetricsHtml(summary) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FinGo — Observabilidade & Defesa Edge</title>
  <style>
    :root {
      --bg: #0A0A0A;
      --surface: #141D12;
      --card: #1A1A1A;
      --border: #282828;
      --acid: #C6FF00;
      --text: #F0F0E8;
      --muted: #8E8E8E;
      --red: #FF3B3B;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; }
    body { background: var(--bg); color: var(--text); padding: 32px 20px; line-height: 1.5; }
    .container { max-width: 960px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--border); padding-bottom: 20px; margin-bottom: 28px; }
    .brand { font-size: 20px; font-weight: 900; color: var(--acid); letter-spacing: 0.05em; }
    .badge-live { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: rgba(198,255,0,0.12); border: 1px solid var(--acid); border-radius: 4px; font-size: 11px; font-weight: 800; color: var(--acid); text-transform: uppercase; }
    .pulse { width: 8px; height: 8px; background: var(--acid); border-radius: 50%; box-shadow: 0 0 8px var(--acid); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(1.2); } }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 18px 20px; }
    .card-title { font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .card-val { font-size: 28px; font-weight: 900; color: var(--text); }
    .card-val.acid { color: var(--acid); }
    .card-val.red { color: var(--red); }
    .card-sub { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .section { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 22px; margin-bottom: 20px; }
    .section h3 { font-size: 14px; font-weight: 800; color: var(--acid); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 14px; }
    .table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .table td, .table th { padding: 8px 12px; border-bottom: 1px solid var(--border); text-align: left; }
    .table th { color: var(--muted); font-weight: 700; text-transform: uppercase; font-size: 11px; }
    .footer { text-align: center; font-size: 11px; color: var(--muted); margin-top: 40px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="brand">FinGo EDGE METRICS</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px;">Telemetria, Performance e Defesa em Tempo Real</div>
      </div>
      <div class="badge-live">
        <span class="pulse"></span> Edge Online (< 15ms)
      </div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">Total Requisições</div>
        <div class="card-val acid">${summary.totalRequests}</div>
        <div class="card-sub">Tráfego total processado</div>
      </div>
      <div class="card">
        <div class="card-title">Latência Média (P50)</div>
        <div class="card-val">${summary.latency.p50}</div>
        <div class="card-sub">P95: ${summary.latency.p95} • P99: ${summary.latency.p99}</div>
      </div>
      <div class="card">
        <div class="card-title">Taxa de Cache (KV)</div>
        <div class="card-val acid">${summary.cache.hitRate}</div>
        <div class="card-sub">${summary.cache.hits} hits • ${summary.cache.misses} misses</div>
      </div>
      <div class="card">
        <div class="card-title">Ataques Bloqueados</div>
        <div class="card-val ${summary.security.blockedRequests > 0 ? 'red' : 'acid'}">${summary.security.blockedRequests}</div>
        <div class="card-sub">Fail2Ban & WAF Ativo</div>
      </div>
    </div>

    <div class="section">
      <h3>📊 Distribuição de Status HTTP</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Significado</th>
            <th>Contagem</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="color:var(--acid);font-weight:800;">2xx</td>
            <td>Sucesso / OK</td>
            <td>${summary.statusCodes['2xx']}</td>
          </tr>
          <tr>
            <td style="color:var(--muted);">3xx</td>
            <td>Redirecionamento Canônico</td>
            <td>${summary.statusCodes['3xx']}</td>
          </tr>
          <tr>
            <td style="color:#FFB800;">4xx</td>
            <td>Cliente / Não Autorizado</td>
            <td>${summary.statusCodes['4xx']}</td>
          </tr>
          <tr>
            <td style="color:var(--red);font-weight:800;">5xx</td>
            <td>Erros de Servidor (Taxa: ${summary.errorRate})</td>
            <td>${summary.statusCodes['5xx']}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="footer">
      FinGo — Obras em Fluxo &bull; Monitoramento de Borda &bull; Atualizado a cada requisição
    </div>
  </div>
</body>
</html>`;
}
