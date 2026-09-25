// backend/graceful_shutdown.js
// Gerenciador de Graceful Shutdown e Drenagem Atômica de Conexões para Render & Node.js

export class GracefulShutdownManager {
  constructor(options = {}) {
    this.timeoutMs = Number(options.timeoutMs || 10000); // 10s limite de drenagem
    this.server = options.server || null;
    this.cron = options.cron || null;
    this.pools = options.pools || [];
    this.redisClients = options.redisClients || [];
    this.onDrain = typeof options.onDrain === 'function' ? options.onDrain : null;
    this.logger = options.logger || console;

    this.isShuttingDown = false;
    this.activeRequestsCount = 0;
    this.activeRequests = new Set();
    this.drainStartTime = 0;
    this.drainedSuccessfully = false;
  }

  setServer(server) {
    this.server = server;
  }

  registerPool(pool) {
    if (pool && !this.pools.includes(pool)) {
      this.pools.push(pool);
    }
  }

  registerRedis(client) {
    if (client && !this.redisClients.includes(client)) {
      this.redisClients.push(client);
    }
  }

  /**
   * Middleware Express para rastreamento de requisições ativas e recusa de novas conexões durante shutdown
   */
  middleware() {
    return (req, res, next) => {
      if (this.isShuttingDown) {
        res.setHeader('Connection', 'close');
        return res.status(503).json({
          error: 'Servidor em processo de drenagem limpa para atualização (SIGTERM). Tente novamente em instantes.',
          shuttingDown: true,
          status: 'draining'
        });
      }

      this.activeRequestsCount += 1;
      this.activeRequests.add(req);

      const cleanup = () => {
        if (this.activeRequests.has(req)) {
          this.activeRequests.delete(req);
          this.activeRequestsCount = Math.max(0, this.activeRequestsCount - 1);
        }
      };

      res.on('finish', cleanup);
      res.on('close', cleanup);

      next();
    };
  }

  /**
   * Executa o processo atômico de desligamento e drenagem graciosa
   */
  async shutdown(signal = 'SIGTERM', options = {}) {
    const exitProcess = options.exit !== false && !options.noExit;
    const timeout = Number(options.timeoutMs || this.timeoutMs || 10000);

    if (this.isShuttingDown) {
      this.logger.warn?.(`⚠️ [GracefulShutdown] Drenagem já em andamento (${signal}). Ignorando chamada duplicada.`);
      return { success: false, reason: 'already_shutting_down' };
    }

    this.isShuttingDown = true;
    this.drainStartTime = Date.now();
    this.logger.log?.(`\n🛑 [GracefulShutdown] Sinal ${signal} recebido. Iniciando drenagem atômica...`);
    this.logger.log?.(`📊 [GracefulShutdown] Requisições em voo no momento do disparo: ${this.activeRequestsCount}`);

    // 1. Parar novas execuções cron imediatamente
    try {
      if (this.cron && typeof this.cron.getTasks === 'function') {
        const tasks = this.cron.getTasks() || [];
        tasks.forEach(t => t.stop?.());
        this.logger.log?.(`✅ [GracefulShutdown] ${tasks.length} rotinas cron paralisadas.`);
      }
    } catch (cronErr) {
      this.logger.warn?.('⚠️ [GracefulShutdown] Aviso ao paralisar tarefas cron:', cronErr.message);
    }

    // 2. Fechar servidor HTTP para novas conexões (server.close)
    if (this.server && typeof this.server.close === 'function') {
      try {
        this.server.close((err) => {
          if (err) this.logger.warn?.('⚠️ [GracefulShutdown] Aviso no fechamento do servidor HTTP:', err.message);
          else this.logger.log?.('✅ [GracefulShutdown] Servidor HTTP não aceita novas conexões.');
        });
      } catch (srvErr) {
        this.logger.warn?.('⚠️ [GracefulShutdown] Erro ao fechar servidor HTTP:', srvErr.message);
      }
    }

    // 3. Aguardar conclusão de todas as requisições em andamento (Drenagem segura até timeoutMs)
    const checkInterval = 20;
    while (this.activeRequestsCount > 0 && (Date.now() - this.drainStartTime) < timeout) {
      await new Promise(r => setTimeout(r, checkInterval));
    }

    const drainElapsed = Date.now() - this.drainStartTime;
    if (this.activeRequestsCount > 0) {
      this.logger.warn?.(`⚠️ [GracefulShutdown] Timeout de drenagem atingido (${timeout}ms). Restaram ${this.activeRequestsCount} requisição(ões). Forçando encerramento.`);
      this.drainedSuccessfully = false;
    } else {
      this.logger.log?.(`✅ [GracefulShutdown] 100% das transações ativas concluídas com sucesso (${drainElapsed}ms).`);
      this.drainedSuccessfully = true;
    }

    // 4. Executar hook de drenagem customizado
    if (this.onDrain) {
      try {
        await this.onDrain();
        this.logger.log?.('✅ [GracefulShutdown] Hook onDrain finalizado com sucesso.');
      } catch (hookErr) {
        this.logger.warn?.('⚠️ [GracefulShutdown] Erro no hook onDrain:', hookErr.message);
      }
    }

    // 5. Encerrar pools de banco de dados (Neon PostgreSQL)
    for (const pool of this.pools) {
      if (pool && typeof pool.end === 'function') {
        try {
          await pool.end();
          this.logger.log?.('✅ [GracefulShutdown] Pool Neon PostgreSQL finalizado.');
        } catch (poolErr) {
          this.logger.warn?.('⚠️ [GracefulShutdown] Aviso ao fechar pool de banco:', poolErr.message);
        }
      }
    }

    // 6. Encerrar clientes Redis
    for (const redis of this.redisClients) {
      if (redis && (typeof redis.quit === 'function' || typeof redis.disconnect === 'function')) {
        try {
          if (typeof redis.quit === 'function') await redis.quit();
          else await redis.disconnect();
          this.logger.log?.('✅ [GracefulShutdown] Cliente Redis desconectado.');
        } catch (redisErr) {
          this.logger.warn?.('⚠️ [GracefulShutdown] Aviso ao desconectar cliente Redis:', redisErr.message);
        }
      }
    }

    this.logger.log?.(`🏁 [GracefulShutdown] Drenagem atômica finalizada com êxito em ${Date.now() - this.drainStartTime}ms.\n`);

    if (exitProcess) {
      process.exit(0);
    }

    return {
      success: true,
      drainedSuccessfully: this.drainedSuccessfully,
      activeRequestsRemaining: this.activeRequestsCount,
      elapsedMs: Date.now() - this.drainStartTime
    };
  }

  /**
   * Reseta o estado (exclusivo para baterias de testes unitários)
   */
  reset() {
    this.isShuttingDown = false;
    this.activeRequestsCount = 0;
    this.activeRequests.clear();
    this.drainedSuccessfully = false;
  }
}

export function createGracefulShutdownManager(options = {}) {
  return new GracefulShutdownManager(options);
}
