// js/suporte.js — Central de Suporte Técnico, Chat Interno, Fila de Espera, Manuais e Tutoriais

const Suporte = {
  WHATSAPP_NUMERO: '5595991363678',
  WHATSAPP_FORMATADO: '(95) 99136-3678',
  STORAGE_CHAT_KEY: 'finobra_suporte_chat',
  STORAGE_CHAMADOS_KEY: 'finobra_suporte_chamados',

  // Estado da sessão atual de atendimento
  sessao: {
    status: 'fechado', // 'fechado', 'fila', 'atendendo'
    posicaoFila: 1,
    tempoEstimado: '< 2 min',
    atendente: 'Especialista FinObra',
    atendenteAvatar: 'EO',
    tempoDecorrido: 0,
    timerFila: null,
    timerMensagens: null
  },

  // ── 1. RENDERIZAR BOTÃO E DROPDOWN NO HEADER ────────────────────────────────
  renderHeaderDropdown() {
    return `
      <div class="suporte-dropdown-wrapper" id="suporte-dropdown-wrapper" style="position:relative;display:inline-block;">
        <button class="header-suporte-btn" onclick="Suporte.toggleDropdown(event)" title="Suporte Técnico e Treinamentos" style="
          display:flex;align-items:center;gap:6px;background:rgba(201,162,39,.1);border:1px solid rgba(201,162,39,.4);
          color:var(--accent2);border-radius:8px;padding:6px 12px;font-size:.8rem;font-weight:700;cursor:pointer;
          transition:all .2s;font-family:inherit;">
          <span style="font-size:.95rem;">🎧</span>
          <span>Suporte Técnico</span>
          <span style="font-size:.65rem;opacity:.7;margin-left:2px;">▼</span>
        </button>

        <div class="suporte-dropdown-menu" id="suporte-dropdown-menu" style="
          display:none;position:absolute;top:calc(100% + 8px);right:0;width:260px;
          background:#121E0D;border:1px solid rgba(201,162,39,.35);border-radius:12px;
          box-shadow:0 12px 36px rgba(0,0,0,.7);z-index:9999;overflow:hidden;backdrop-filter:blur(10px);">
          
          <div style="padding:12px 14px;background:rgba(201,162,39,.12);border-bottom:1px solid rgba(201,162,39,.2);display:flex;align-items:center;gap:8px;">
            <span style="font-size:1.1rem;color:#f59e0b;">🎧</span>
            <span style="font-weight:800;font-size:.85rem;color:var(--accent2);letter-spacing:.02em;">Suporte Técnico</span>
          </div>

          <div style="padding:6px 0;">
            <a href="javascript:void(0)" onclick="Suporte.abrirTelaAtendimento();Suporte.fecharDropdown();" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#38bdf8;">💬</span>
              <span>Conversar com Especialista</span>
            </a>

            <a href="javascript:void(0)" onclick="Suporte.abrirManual();Suporte.fecharDropdown();" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#a3e635;">📖</span>
              <span>Manual do Sistema</span>
            </a>

            <a href="javascript:void(0)" onclick="Suporte.abrirTutoriais();Suporte.fecharDropdown();" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#f43f5e;">🖥️</span>
              <span>Tutoriais do Sistema</span>
            </a>

            <a href="javascript:void(0)" onclick="Suporte.abrirAgendamento();Suporte.fecharDropdown();" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#fbbf24;">📅</span>
              <span>Agenda Treinamentos</span>
            </a>

            <a href="javascript:void(0)" onclick="Suporte.abrirContatos();Suporte.fecharDropdown();" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#34d399;">📞</span>
              <span>Contatos Suporte</span>
            </a>

            <a href="javascript:void(0)" onclick="Suporte.abrirTreinamentos();Suporte.fecharDropdown();" class="suporte-menu-item" style="display:flex;align-items:center;gap:12px;padding:10px 16px;color:#f0ead6;text-decoration:none;font-size:.85rem;transition:background .2s;">
              <span style="font-size:1.05rem;color:#c084fc;">▶️</span>
              <span>Treinamentos</span>
            </a>
          </div>
        </div>
      </div>
    `;
  },

  toggleDropdown(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('suporte-dropdown-menu');
    if (!menu) return;
    const isVis = menu.style.display === 'block';
    this.fecharDropdown();
    if (!isVis) {
      menu.style.display = 'block';
      setTimeout(() => {
        document.addEventListener('click', Suporte._outsideClickListener);
      }, 50);
    }
  },

  fecharDropdown() {
    const menu = document.getElementById('suporte-dropdown-menu');
    if (menu) menu.style.display = 'none';
    document.removeEventListener('click', Suporte._outsideClickListener);
  },

  _outsideClickListener(e) {
    const wrap = document.getElementById('suporte-dropdown-wrapper');
    if (wrap && !wrap.contains(e.target)) {
      Suporte.fecharDropdown();
    }
  },

  // ── 2. TELA DE ATENDIMENTO COM FILA DE ESPERA & CHAT INTERNO ───────────────
  abrirTelaAtendimento() {
    this.fecharDropdown();
    this.sessao.status = 'fila';
    this.sessao.posicaoFila = 1;
    this.sessao.tempoEstimado = '< 2 min';
    this.sessao.tempoDecorrido = 0;

    let modal = document.getElementById('suporte-atendimento-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-atendimento-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }

    this.renderTelaFila();
    this.iniciarSimulacaoFila();
  },

  renderTelaFila() {
    const modal = document.getElementById('suporte-atendimento-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.35);border-radius:14px;width:100%;max-width:580px;box-shadow:0 24px 60px rgba(0,0,0,.8);overflow:hidden;font-family:inherit;color:#f0ead6;animation:fadeIn .25s ease-out;">
        
        <!-- Header da Janela -->
        <div style="background:linear-gradient(135deg, #1C2D12, #2A3F1B);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(201,162,39,.2);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;font-size:1.2rem;">
              🎧
            </div>
            <div>
              <div style="font-weight:800;font-size:.95rem;color:var(--accent2);display:flex;align-items:center;gap:8px;">
                Suporte FinObra
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8;animation:pulse 1.5s infinite;"></span>
              </div>
              <div style="font-size:.75rem;color:#94a3b8;">Aguardando atendimento de especialista</div>
            </div>
          </div>
          <button onclick="Suporte.desistirAtendimento()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;border-radius:6px;" title="Fechar">✕</button>
        </div>

        <!-- Conteúdo: Fila e Status -->
        <div style="padding:24px;">
          <!-- Card de Posição na Fila (conforme a imagem do usuário) -->
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:24px 20px;margin-bottom:20px;display:flex;flex-direction:column;gap:18px;">
            
            <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;">
              <!-- Spinner / Círculo Animado com #1 -->
              <div style="position:relative;width:80px;height:80px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                <svg width="80" height="80" viewBox="0 0 80 80" style="transform:rotate(-90deg);">
                  <circle cx="40" cy="40" r="34" stroke="rgba(201,162,39,0.15)" stroke-width="6" fill="transparent" />
                  <circle cx="40" cy="40" r="34" stroke="var(--accent)" stroke-width="6" fill="transparent" stroke-dasharray="213" stroke-dashoffset="60" stroke-linecap="round" style="animation:dash 2s ease-in-out infinite alternate;" />
                </svg>
                <div style="position:absolute;text-align:center;">
                  <div style="font-size:.65rem;color:#94a3b8;line-height:1;">Posição</div>
                  <div style="font-size:1.4rem;font-weight:900;color:var(--accent2);line-height:1.2;">#1</div>
                </div>
              </div>

              <!-- Mensagem da Fila -->
              <div style="flex:1;min-width:200px;">
                <div style="font-weight:700;font-size:.92rem;color:#fff;margin-bottom:4px;">
                  Um especialista vai te atender em instantes.
                </div>
                <div style="font-size:.8rem;color:#94a3b8;">
                  Mantenha esta janela aberta para iniciar a conversa.
                </div>

                <!-- Barra de Progresso Animada -->
                <div style="margin-top:10px;height:6px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden;position:relative;">
                  <div style="width:45%;height:100%;background:linear-gradient(90deg, #10b981, var(--accent));border-radius:3px;animation:indeterminate 2s infinite linear;"></div>
                </div>
              </div>
            </div>

            <!-- Tempo Estimado e Botão Desistir -->
            <div style="display:flex;align-items:center;justify-content:space-between;padding-top:14px;border-top:1px solid rgba(255,255,255,.06);flex-wrap:wrap;gap:12px;">
              <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.3);color:#38bdf8;padding:6px 14px;border-radius:20px;font-size:.8rem;font-weight:600;">
                <span>⏱️</span>
                <span>Tempo estimado: <strong>&lt; 2 min</strong></span>
              </div>

              <div style="display:flex;align-items:center;gap:8px;">
                <button onclick="Suporte.desistirAtendimento()" style="background:#dc2626;border:none;color:#fff;padding:8px 18px;border-radius:8px;font-size:.82rem;font-weight:700;cursor:pointer;transition:background .2s;">
                  Desistir do Atendimento
                </button>
                <button onclick="Suporte.conectarAgora()" style="background:var(--accent);border:none;color:#0f1710;padding:8px 18px;border-radius:8px;font-size:.82rem;font-weight:800;cursor:pointer;transition:opacity .2s;" title="Conectar imediatamente com o especialista">
                  Conectar Agora ⚡
                </button>
              </div>
            </div>

          </div>

          <!-- Seção 'Enquanto Aguarda' (Idêntica à imagem enviada) -->
          <div style="margin-top:20px;">
            <div style="font-size:.72rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;display:flex;align-items:center;gap:8px;">
              <span>Enquanto Aguarda</span>
              <div style="flex:1;height:1px;background:rgba(255,255,255,.08);"></div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <!-- Card Youtube -->
              <div onclick="Suporte.abrirTutoriais()" style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:all .2s;hover:border-color:var(--accent);">
                <div>
                  <div style="font-size:.7rem;color:#94a3b8;">Canal Oficial</div>
                  <div style="font-weight:700;font-size:.82rem;color:#fff;margin-top:2px;">Tutoriais em Vídeo</div>
                </div>
                <span style="font-size:1.4rem;color:#ef4444;">▶️</span>
              </div>

              <!-- Card Manual -->
              <div onclick="Suporte.abrirManual()" style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;transition:all .2s;">
                <div>
                  <div style="font-size:.7rem;color:#94a3b8;">Manual do Sistema</div>
                  <div style="font-weight:700;font-size:.82rem;color:#fff;margin-top:2px;">Documentação completa</div>
                </div>
                <span style="font-size:1.4rem;color:#38bdf8;">📖</span>
              </div>
            </div>
          </div>

          <!-- Botão de WhatsApp Alternativo -->
          <div style="margin-top:18px;text-align:center;">
            <a href="${this.getLinkWhatsApp('Olá! Estou no sistema FinObra e gostaria de atendimento do suporte.')}" target="_blank" style="color:var(--accent2);font-size:.78rem;text-decoration:none;display:inline-flex;align-items:center;gap:6px;">
              <span>Preferir atendimento via WhatsApp oficial?</span>
              <strong style="color:#22c55e;">Clique aqui (95) 99136-3678 ↗</strong>
            </a>
          </div>
        </div>
      </div>
    `;
  },

  iniciarSimulacaoFila() {
    if (this.sessao.timerFila) clearTimeout(this.sessao.timerFila);
    // Em 4 segundos simula a conexão com o atendente
    this.sessao.timerFila = setTimeout(() => {
      if (this.sessao.status === 'fila') {
        this.conectarAgora();
      }
    }, 4500);
  },

  conectarAgora() {
    if (this.sessao.timerFila) clearTimeout(this.sessao.timerFila);
    this.sessao.status = 'atendendo';
    this.renderTelaChat();
  },

  // ── 3. TELA DE CHAT EM TEMPO REAL ──────────────────────────────────────────
  renderTelaChat() {
    const modal = document.getElementById('suporte-atendimento-modal');
    if (!modal) return;

    const u = (typeof Auth !== 'undefined' && Auth.getUser()) || { nome: 'Usuário', empresaNome: 'Minha Empresa' };
    const historico = this.getHistoricoChat();

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:640px;height:620px;max-height:92vh;box-shadow:0 24px 60px rgba(0,0,0,.85);display:flex;flex-direction:column;overflow:hidden;font-family:inherit;color:#f0ead6;animation:fadeIn .25s ease-out;">
        
        <!-- Header do Chat -->
        <div style="background:linear-gradient(135deg, #1C2D12, #243818);padding:14px 18px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="position:relative;">
              <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg, var(--accent), #9a7b1c);color:#0f1710;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.9rem;">
                FO
              </div>
              <span style="position:absolute;bottom:0;right:0;width:10px;height:10px;background:#22c55e;border:2px solid #0f1710;border-radius:50%;"></span>
            </div>
            <div>
              <div style="font-weight:800;font-size:.92rem;color:var(--accent2);display:flex;align-items:center;gap:6px;">
                Especialista FinObra
                <span style="background:rgba(34,197,94,.15);color:#22c55e;font-size:.65rem;padding:1px 6px;border-radius:10px;border:1px solid rgba(34,197,94,.3);">Online</span>
              </div>
              <div style="font-size:.72rem;color:#94a3b8;">Atendimento exclusivo para ${u.empresaNome || 'sua empresa'}</div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:8px;">
            <a href="${this.getLinkWhatsApp(`Olá, estou no chat de suporte do FinObra (${u.empresaNome || u.nome}) e gostaria de continuar o atendimento por aqui.`)}" target="_blank" class="btn-clean" style="padding:5px 10px;background:rgba(34,197,94,.12);border:1px solid #22c55e;color:#22c55e;border-radius:6px;font-size:.72rem;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:4px;" title="Migrar para o WhatsApp">
              <span>💬 WhatsApp</span>
            </a>
            <button onclick="Suporte.encerrarChat()" style="background:none;border:1px solid rgba(255,255,255,.15);color:#94a3b8;padding:4px 10px;border-radius:6px;font-size:.72rem;cursor:pointer;">
              Encerrar
            </button>
            <button onclick="Suporte.desistirAtendimento()" style="background:none;border:none;color:#94a3b8;font-size:1.1rem;cursor:pointer;padding:2px 6px;" title="Fechar">✕</button>
          </div>
        </div>

        <!-- Área de Mensagens (Scroll) -->
        <div id="suporte-chat-msgs" style="flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;background:radial-gradient(ellipse at top, rgba(28,45,18,.3), transparent 70%);">
          
          <div style="text-align:center;margin-bottom:8px;">
            <span style="background:rgba(255,255,255,.05);padding:4px 12px;border-radius:12px;font-size:.7rem;color:#94a3b8;border:1px solid rgba(255,255,255,.05);">
              Atendimento iniciado hoje às ${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
            </span>
          </div>

          <!-- Mensagem inicial do Especialista -->
          <div style="display:flex;gap:10px;align-items:flex-start;max-width:85%;">
            <div style="width:30px;height:30px;border-radius:50%;background:var(--accent);color:#0f1710;font-size:.7rem;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              FO
            </div>
            <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);padding:10px 14px;border-radius:0 12px 12px 12px;font-size:.85rem;line-height:1.45;color:#e2e8f0;">
              Olá, <strong>${u.nome || 'Parceiro'}</strong>! Sou o especialista de suporte técnico do FinObra.<br>
              Como posso te ajudar hoje com as obras, medições, notas fiscais ou relatórios da <strong>${u.empresaNome || 'sua empresa'}</strong>?
              <div style="font-size:.65rem;color:#64748b;margin-top:6px;text-align:right;">${new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</div>
            </div>
          </div>

          <!-- Renderizar mensagens gravadas -->
          ${historico.map(m => this.renderBolhaMensagem(m)).join('')}

        </div>

        <!-- Rodapé de Envio -->
        <div style="padding:12px 16px;background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:10px;flex-shrink:0;">
          <input type="text" id="suporte-chat-input" placeholder="Digite sua mensagem ou dúvida aqui..." style="flex:1;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:10px 14px;color:#fff;font-size:.85rem;outline:none;" onkeydown="if(event.key==='Enter') Suporte.enviarMensagem()">
          
          <button onclick="Suporte.enviarMensagem()" style="background:var(--accent);border:none;color:#0f1710;font-weight:800;padding:10px 16px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:.85rem;transition:transform .1s;" title="Enviar mensagem">
            <span>Enviar</span>
            <span>➤</span>
          </button>
        </div>

      </div>
    `;

    setTimeout(() => {
      const inp = document.getElementById('suporte-chat-input');
      if (inp) inp.focus();
      this.scrollChatToBottom();
    }, 100);
  },

  renderBolhaMensagem(m) {
    const isMe = m.origem === 'cliente';
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;max-width:85%;${isMe ? 'align-self:flex-end;flex-direction:row-reverse;' : ''}">
        <div style="width:30px;height:30px;border-radius:50%;background:${isMe ? '#243818' : 'var(--accent)'};border:1px solid rgba(201,162,39,.4);color:${isMe ? '#f0ead6' : '#0f1710'};font-size:.7rem;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${isMe ? 'VC' : 'FO'}
        </div>
        <div style="background:${isMe ? 'linear-gradient(135deg, #1C2D12, #243818)' : 'rgba(255,255,255,.06)'};border:1px solid ${isMe ? 'rgba(201,162,39,.3)' : 'rgba(255,255,255,.1)'};padding:10px 14px;border-radius:${isMe ? '12px 0 12px 12px' : '0 12px 12px 12px'};font-size:.85rem;line-height:1.45;color:#f8fafc;">
          ${m.texto}
          <div style="font-size:.65rem;color:${isMe ? '#94a3b8' : '#64748b'};margin-top:6px;text-align:right;">${m.hora || ''}</div>
        </div>
      </div>
    `;
  },

  enviarMensagem() {
    const inp = document.getElementById('suporte-chat-input');
    if (!inp || !inp.value.trim()) return;

    const texto = inp.value.trim();
    inp.value = '';

    const novaMsg = {
      id: 'msg_' + Date.now(),
      origem: 'cliente',
      texto,
      hora: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
      data: new Date().toISOString()
    };

    const historico = this.getHistoricoChat();
    historico.push(novaMsg);
    this.salvarHistoricoChat(historico);

    // Registra nos chamados para o Dev/Master visualizar
    this.notificarChamadoMaster(texto);

    // Adiciona na interface
    const container = document.getElementById('suporte-chat-msgs');
    if (container) {
      container.insertAdjacentHTML('beforeend', this.renderBolhaMensagem(novaMsg));
      this.scrollChatToBottom();
    }

    // Resposta automática / inteligente de suporte após 1.5 segundos
    setTimeout(() => {
      this.gerarRespostaSuporte(texto);
    }, 1500);
  },

  gerarRespostaSuporte(textoCliente) {
    const t = textoCliente.toLowerCase();
    let resposta = 'Perfeito! Já recebi sua dúvida e nosso time de engenharia técnica está analisando seu caso agora mesmo. Se for urgente, você também pode nos acionar diretamente pelo WhatsApp!';

    if (t.includes('nota') || t.includes('nfe') || t.includes('ocr')) {
      resposta = 'Sobre Notas Fiscais e OCR: lembre-se que ao enviar o PDF ou XML no módulo de Notas Fiscais, o sistema lê os insumos automaticamente e alimenta suas compras!';
    } else if (t.includes('medicao') || t.includes('medição') || t.includes('caixa')) {
      resposta = 'Sobre Medições de Obras: você pode gerar o relatório no padrão Caixa Econômica diretamente pela aba "Medições & Faturamento", com histórico de evolução acumulada.';
    } else if (t.includes('ofx') || t.includes('banco') || t.includes('extrato')) {
      resposta = 'Para conciliação bancária: basta arrastar o arquivo .OFX exportado do seu banco na aba "Conciliação OFX" para conciliar receitas e pagamentos com um clique.';
    } else if (t.includes('whatsapp') || t.includes('contato') || t.includes('telefone')) {
      resposta = `Nosso suporte direto no WhatsApp é pelo número **${this.WHATSAPP_FORMATADO}**. Estamos online para te atender!`;
    }

    const msgSuporte = {
      id: 'msg_' + Date.now(),
      origem: 'suporte',
      texto: resposta,
      hora: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
      data: new Date().toISOString()
    };

    const historico = this.getHistoricoChat();
    historico.push(msgSuporte);
    this.salvarHistoricoChat(historico);

    const container = document.getElementById('suporte-chat-msgs');
    if (container) {
      container.insertAdjacentHTML('beforeend', this.renderBolhaMensagem(msgSuporte));
      this.scrollChatToBottom();
    }
  },

  scrollChatToBottom() {
    const container = document.getElementById('suporte-chat-msgs');
    if (container) container.scrollTop = container.scrollHeight;
  },

  getHistoricoChat() {
    try {
      const s = localStorage.getItem(this.STORAGE_CHAT_KEY);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  },

  salvarHistoricoChat(h) {
    try { localStorage.setItem(this.STORAGE_CHAT_KEY, JSON.stringify(h)); } catch {}
  },

  notificarChamadoMaster(ultimaMensagem) {
    try {
      const u = (typeof Auth !== 'undefined' && Auth.getUser()) || {};
      const chamados = JSON.parse(localStorage.getItem(this.STORAGE_CHAMADOS_KEY) || '[]');
      const idTenant = u.tenantId || 'tenant_geral';
      
      let chamado = chamados.find(c => c.tenantId === idTenant);
      if (!chamado) {
        chamado = {
          id: 'chamado_' + Date.now(),
          tenantId: idTenant,
          empresaNome: u.empresaNome || 'Empresa Cliente',
          usuarioNome: u.nome || 'Usuário',
          status: 'aberto',
          abertoEm: new Date().toISOString(),
          mensagensQtd: 0
        };
        chamados.unshift(chamado);
      }
      chamado.status = 'aberto';
      chamado.ultimaMsg = ultimaMensagem;
      chamado.atualizadoEm = new Date().toISOString();
      chamado.mensagensQtd = (chamado.mensagensQtd || 0) + 1;

      localStorage.setItem(this.STORAGE_CHAMADOS_KEY, JSON.stringify(chamados));
    } catch {}
  },

  encerrarChat() {
    if (confirm('Deseja encerrar o atendimento atual? O histórico ficará salvo.')) {
      this.desistirAtendimento();
    }
  },

  desistirAtendimento() {
    if (this.sessao.timerFila) clearTimeout(this.sessao.timerFila);
    this.sessao.status = 'fechado';
    const modal = document.getElementById('suporte-atendimento-modal');
    if (modal) modal.remove();
  },

  getLinkWhatsApp(msg) {
    const texto = encodeURIComponent(msg || 'Olá! Preciso de suporte no FinObra.');
    return `https://wa.me/${this.WHATSAPP_NUMERO}?text=${texto}`;
  },

  // ── 4. MODAL: MANUAL DO SISTEMA ───────────────────────────────────────────
  abrirManual() {
    this.fecharDropdown();
    let modal = document.getElementById('suporte-manual-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-manual-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:760px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.8);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;">📖</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Manual do Usuário — FinObra</div>
              <div style="font-size:.75rem;color:#94a3b8;">Guia rápido de operações e funcionalidades</div>
            </div>
          </div>
          <button onclick="document.getElementById('suporte-manual-modal').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:22px;display:flex;flex-direction:column;gap:16px;">
          
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">🏗️ 1. Obras & Clientes</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Cadastre suas obras (Caixa ou Particulares), definindo o cliente, tipo de contrato, valor global orçado e cronograma. Ao selecionar uma obra no topo do sistema, todos os lançamentos e relatórios são filtrados automaticamente.
            </p>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">📄 2. Notas Fiscais & Leitura OCR</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Envie fotos ou PDFs de Notas Fiscais (NF-e/NFS-e). O sistema lê automaticamente a chave de acesso, fornecedor, valores e insumos discriminados, cadastrando as despesas da obra sem digitação manual.
            </p>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">🔨 3. Medições & Faturamento</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Lance medições de campo com percentuais acumulados das etapas executadas. Emita boletins de medição prontos para envio ao engenheiro fiscal da Caixa Econômica ou proprietário.
            </p>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">🔄 4. Conciliação Bancária OFX</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Importe o extrato em formato OFX da conta da construtora para conciliar e bater cada PIX, débito ou transferência com os lançamentos das obras.
            </p>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <h4 style="color:var(--accent2);margin-bottom:6px;display:flex;align-items:center;gap:6px;">🛡️ 5. Assinatura Eletrônica & Validação Pública</h4>
            <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
              Recibos e contratos gerados pelo FinObra recebem hash criptográfico SHA-256 e QR Code. Qualquer cliente ou fiscal pode validar a autenticidade online pelo portal público <strong style="color:var(--accent2);">finobra.app.br/validar</strong>.
            </p>
          </div>

        </div>

        <div style="padding:14px 20px;background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:flex-end;">
          <button onclick="document.getElementById('suporte-manual-modal').remove()" style="background:var(--accent);border:none;color:#0f1710;padding:8px 20px;border-radius:8px;font-weight:800;cursor:pointer;">Entendido</button>
        </div>
      </div>
    `;
  },

  // ── 5. MODAL: TUTORIAIS DO SISTEMA ────────────────────────────────────────
  abrirTutoriais() {
    this.fecharDropdown();
    let modal = document.getElementById('suporte-tutoriais-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-tutoriais-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:700px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.8);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;color:#f43f5e;">🖥️</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Tutoriais em Vídeo & Guias</div>
              <div style="font-size:.75rem;color:#94a3b8;">Vídeos passo a passo para dominar a gestão de obras</div>
            </div>
          </div>
          <button onclick="document.getElementById('suporte-tutoriais-modal').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <div style="flex:1;overflow-y:auto;padding:22px;display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:.75rem;color:#38bdf8;font-weight:700;">VÍDEO 1 • 4 MIN</div>
              <div style="font-weight:800;font-size:.9rem;color:#fff;margin:4px 0;">Como Iniciar uma Obra e Cadastrar Etapas</div>
              <div style="font-size:.78rem;color:#94a3b8;">Aprenda a estruturar o contrato e prever os custos.</div>
            </div>
            <button onclick="alert('Assistir tutorial: Redirecionando para o canal oficial...')" style="margin-top:12px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">
              Assistir Aula ▶
            </button>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:.75rem;color:#38bdf8;font-weight:700;">VÍDEO 2 • 3 MIN</div>
              <div style="font-weight:800;font-size:.9rem;color:#fff;margin:4px 0;">Importação Automática de NF-e e OCR</div>
              <div style="font-size:.78rem;color:#94a3b8;">Como escanear notas fiscais de materiais sem erro.</div>
            </div>
            <button onclick="alert('Assistir tutorial: Redirecionando para o canal oficial...')" style="margin-top:12px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">
              Assistir Aula ▶
            </button>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:.75rem;color:#38bdf8;font-weight:700;">VÍDEO 3 • 5 MIN</div>
              <div style="font-weight:800;font-size:.9rem;color:#fff;margin:4px 0;">Boletim de Medição Caixa Econômica</div>
              <div style="font-size:.78rem;color:#94a3b8;">Passo a passo para gerar o espelho de medição de engenharia.</div>
            </div>
            <button onclick="alert('Assistir tutorial: Redirecionando para o canal oficial...')" style="margin-top:12px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">
              Assistir Aula ▶
            </button>
          </div>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="font-size:.75rem;color:#38bdf8;font-weight:700;">VÍDEO 4 • 4 MIN</div>
              <div style="font-weight:800;font-size:.9rem;color:#fff;margin:4px 0;">Conciliação OFX e Fechamento Mensal</div>
              <div style="font-size:.78rem;color:#94a3b8;">DRE, fluxo de caixa e batimento com a conta bancária.</div>
            </div>
            <button onclick="alert('Assistir tutorial: Redirecionando para o canal oficial...')" style="margin-top:12px;background:rgba(201,162,39,.15);border:1px solid var(--accent);color:var(--accent2);padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;cursor:pointer;">
              Assistir Aula ▶
            </button>
          </div>

        </div>

        <div style="padding:14px 20px;background:rgba(0,0,0,.3);border-top:1px solid rgba(255,255,255,.08);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:.8rem;color:#94a3b8;">Canal Oficial FinObra no YouTube</span>
          <button onclick="document.getElementById('suporte-tutoriais-modal').remove()" style="background:var(--accent);border:none;color:#0f1710;padding:8px 20px;border-radius:8px;font-weight:800;cursor:pointer;">Fechar</button>
        </div>
      </div>
    `;
  },

  // ── 6. MODAL: AGENDA DE TREINAMENTOS ──────────────────────────────────────
  abrirAgendamento() {
    this.fecharDropdown();
    let modal = document.getElementById('suporte-agendamento-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-agendamento-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }

    const u = (typeof Auth !== 'undefined' && Auth.getUser()) || {};

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:540px;box-shadow:0 24px 60px rgba(0,0,0,.8);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;color:#fbbf24;">📅</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Agendar Treinamento com Especialista</div>
              <div style="font-size:.75rem;color:#94a3b8;">Sessão ao vivo de implantação para sua equipe</div>
            </div>
          </div>
          <button onclick="document.getElementById('suporte-agendamento-modal').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <div style="padding:22px;display:flex;flex-direction:column;gap:16px;">
          <p style="font-size:.85rem;color:#cbd5e1;line-height:1.5;">
            Treine sua equipe de engenharia, compras e financeiro para extrair o máximo do FinObra. O treinamento inclui configuração inicial de obras, medições Caixa e fluxo de caixa.
          </p>

          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;">
            <div style="font-size:.8rem;color:#94a3b8;margin-bottom:6px;">Duração da sessão:</div>
            <div style="font-weight:800;font-size:1rem;color:#fff;">45 a 60 minutos (Google Meet / Ao Vivo)</div>
          </div>

          <a href="${this.getLinkWhatsApp(`Olá! Gostaria de agendar um treinamento do FinObra para a equipe da minha empresa (${u.empresaNome || u.nome || 'minha construtora'}).`)}" target="_blank" style="background:#22c55e;border:none;color:#fff;padding:14px;border-radius:10px;font-weight:800;font-size:.9rem;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 4px 16px rgba(34,197,94,.3);">
            <span>📅 Agendar pelo WhatsApp: (95) 99136-3678</span>
          </a>
        </div>
      </div>
    `;
  },

  // ── 7. MODAL: CONTATOS OFICIAIS DO SUPORTE ────────────────────────────────
  abrirContatos() {
    this.fecharDropdown();
    let modal = document.getElementById('suporte-contatos-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'suporte-contatos-modal';
      modal.className = 'modal-backdrop';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:99999;backdrop-filter:blur(4px);padding:16px;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background:#0f1710;border:1px solid rgba(201,162,39,.4);border-radius:14px;width:100%;max-width:520px;box-shadow:0 24px 60px rgba(0,0,0,.8);overflow:hidden;color:#f0ead6;font-family:inherit;">
        <div style="background:linear-gradient(135deg,#1C2D12,#243818);padding:16px 20px;border-bottom:1px solid rgba(201,162,39,.3);display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.3rem;color:#34d399;">📞</span>
            <div>
              <div style="font-weight:800;font-size:1rem;color:var(--accent2);">Canais de Suporte & Atendimento</div>
              <div style="font-size:.75rem;color:#94a3b8;">Estamos prontos para atender sua construtora</div>
            </div>
          </div>
          <button onclick="document.getElementById('suporte-contatos-modal').remove()" style="background:none;border:none;color:#94a3b8;font-size:1.2rem;cursor:pointer;padding:4px 8px;">✕</button>
        </div>

        <div style="padding:22px;display:flex;flex-direction:column;gap:14px;">
          
          <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,.08);">
            <span style="font-size:1.5rem;color:#22c55e;">💬</span>
            <div style="flex:1;">
              <div style="font-size:.75rem;color:#94a3b8;">WhatsApp Suporte Técnico</div>
              <div style="font-weight:800;font-size:.95rem;color:#fff;">(95) 99136-3678</div>
            </div>
            <a href="${this.getLinkWhatsApp()}" target="_blank" style="background:#22c55e;color:#fff;padding:6px 12px;border-radius:6px;font-size:.75rem;font-weight:700;text-decoration:none;">Chamar ↗</a>
          </div>

          <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,.08);">
            <span style="font-size:1.5rem;color:#38bdf8;">✉️</span>
            <div style="flex:1;">
              <div style="font-size:.75rem;color:#94a3b8;">E-mail do Suporte</div>
              <div style="font-weight:800;font-size:.95rem;color:#fff;">suporte@finobra.app.br</div>
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.03);padding:14px;border-radius:10px;border:1px solid rgba(255,255,255,.08);">
            <span style="font-size:1.5rem;color:#fbbf24;">🕒</span>
            <div style="flex:1;">
              <div style="font-size:.75rem;color:#94a3b8;">Horário de Atendimento</div>
              <div style="font-weight:800;font-size:.95rem;color:#fff;">Segunda a Sexta: 08:00 às 18:00 (Plantão aos Sábados)</div>
            </div>
          </div>

        </div>
      </div>
    `;
  },

  // ── 8. MODAL: TRILHA DE TREINAMENTOS ──────────────────────────────────────
  abrirTreinamentos() {
    this.abrirTutoriais();
  }
};
