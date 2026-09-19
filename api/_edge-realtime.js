// api/_edge-realtime.js — Colaboração em Tempo Real via Durable Objects & WebSockets
// Permite que múltiplos engenheiros e gestores editem orçamentos e medições concorrentemente sem conflitos.

/**
 * Classe Durable Object que gerencia uma sala de edição de orçamento/obra em tempo real.
 */
export class BudgetSyncRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // WebSocket -> { userId, userName, role, joinedAt }
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Endpoint de handshake WebSocket
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const userId = url.searchParams.get('userId') || `user_${Math.random().toString(36).substr(2, 6)}`;
      const userName = url.searchParams.get('userName') || 'Engenheiro Convidado';
      const role = url.searchParams.get('role') || 'editor';

      await this.handleSession(server, { userId, userName, role });

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    // Endpoint HTTP de status da sala
    if (url.pathname.endsWith('/status')) {
      return new Response(JSON.stringify({
        activeSessions: this.sessions.size,
        collaborators: Array.from(this.sessions.values()).map(s => ({
          userId: s.userId,
          userName: s.userName,
          role: s.role
        }))
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('FinGo Realtime Room Active', { status: 200 });
  }

  async handleSession(webSocket, userInfo) {
    webSocket.accept();
    this.sessions.set(webSocket, { ...userInfo, joinedAt: Date.now() });

    // Notifica todos que um novo usuário entrou
    this.broadcast({
      type: 'user_joined',
      user: userInfo,
      activeCount: this.sessions.size
    }, webSocket);

    webSocket.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'item_updated':
          case 'etapa_reordered':
          case 'bdi_changed':
          case 'cell_focus':
            // Propaga a alteração para os outros colaboradores da sala
            this.broadcast({
              ...message,
              sender: userInfo,
              timestamp: Date.now()
            }, webSocket);
            break;

          case 'ping':
            webSocket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
            break;

          default:
            this.broadcast(message, webSocket);
        }
      } catch (err) {
        console.warn('[FinGo Realtime] Mensagem inválida recebida:', err?.message || err);
      }
    });

    const closeHandler = () => {
      this.sessions.delete(webSocket);
      this.broadcast({
        type: 'user_left',
        userId: userInfo.userId,
        activeCount: this.sessions.size
      });
    };

    webSocket.addEventListener('close', closeHandler);
    webSocket.addEventListener('error', closeHandler);
  }

  broadcast(message, senderSocket = null) {
    const serialized = JSON.stringify(message);
    for (const [socket] of this.sessions.entries()) {
      if (socket !== senderSocket && socket.readyState === 1 /* OPEN */) {
        try {
          socket.send(serialized);
        } catch {
          this.sessions.delete(socket);
        }
      }
    }
  }
}
