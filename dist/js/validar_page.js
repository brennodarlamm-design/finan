// FinObra Patch 10 — script extraído para CSP
// ─────────────────────────────────────────────────────────────
    // MOTOR DE CONSULTA E VALIDAÇÃO DE AUTENTICIDADE
    // ─────────────────────────────────────────────────────────────

    // Função para sanitização rigorosa contra injeções de HTML/XSS
    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Normaliza código para comparação insensível a traços, espaços e maiúsculas
    function normalizar(txt) {
      return (txt || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    }

    async function localizarRegistro(codigoBuscado) {
      if (!codigoBuscado) return null;
      const code = String(codigoBuscado).trim().toUpperCase();
      if (!/^[A-Z0-9-]{8,80}$/.test(code)) return null;
      const urlParams = new URLSearchParams(window.location.search);
      const hash = (urlParams.get('hash') || '').trim();
      const qs = new URLSearchParams({ code });
      if (hash) qs.set('hash', hash);
      const res = await fetch('/api/assinaturas?' + qs.toString(), { headers: { 'Accept': 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.valid && data.record) return data.record;
      if (res.status === 404 || data.valid === false) return null;
      throw new Error(data.error || 'Não foi possível consultar a base central.');
    }

    async function executarBusca() {
      const input = document.getElementById('input-codigo');
      const codigo = (input.value || '').trim();
      const container = document.getElementById('resultado-container');

      if (!codigo) {
        input.focus();
        return;
      }

      container.innerHTML = `<div class="idle-card"><div class="idle-icon">🔄</div><div class="idle-text">Consultando registro na base central do FinObra…</div></div>`;

      let registro;
      try {
        registro = await localizarRegistro(codigo);
      } catch (err) {
        container.innerHTML = `<div class="error-card"><div class="error-icon">⚠️</div><div class="error-title">Falha na consulta</div><div class="error-desc">${escapeHtml(err?.message || 'Não foi possível acessar a base central.')}</div></div>`;
        return;
      }

      if (!registro) {
        container.innerHTML = `
          <div class="error-card">
            <div class="error-icon">⚠️</div>
            <div class="error-title">Código de Validação Não Localizado</div>
            <div class="error-desc">
              Não encontramos nenhum documento ou assinatura com o código <strong>"${escapeHtml(codigo)}"</strong>.<br>
              Certifique-se de que os números e letras foram digitados exatamente como impressos no carimbo ou recibo.<br>
              <em>Exemplo de formato: FIN-SIG-XXXXXXXX-XXXXXXXX</em>
            </div>
            <button class="btn-action" data-fb-click="Patch26Actions.resetAndFocusById" data-fb-click-n="1" data-fb-click-t0="string" data-fb-click-v0="input-codigo">
              Limpar e Tentar Novamente
            </button>
          </div>
        `;
        return;
      }

      // Registro localizado: renderizar comprovante de consulta
      const tipoDocFmt = registro.doc_tipo === 'contrato' ? 'Contrato de Construção Civil / Empreitada (MCMV)'
                       : registro.doc_tipo === 'recibo' ? 'Recibo Oficial de Pagamento'
                       : 'Documento Financeiro / Jurídico';

      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=${encodeURIComponent(window.location.href)}`;

      const statusBadgeHtml = `<div class="status-badge-ok">
             <span class="pulse-dot"></span>
             ✓ REGISTRO LOCALIZADO NA BASE CENTRAL
           </div>`;

      const statusAuditHtml = `<span class="data-val" style="color:#10b981;font-weight:800;">✓ REGISTRADO &bull; CONSULTA ONLINE</span>`;

      container.innerHTML = `
        <div style="text-align:center;margin-bottom:16px;">
          ${statusBadgeHtml}
        </div>

        <div class="data-table">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(201,162,39,0.3);">
            <span style="font-size:.78rem;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;">
              Comprovante de Registro Central
            </span>
            <span style="font-family:monospace;font-size:.85rem;background:rgba(201,162,39,0.15);color:var(--accent2);padding:3px 10px;border-radius:4px;font-weight:800;border:1px solid rgba(201,162,39,0.3);">
              ${escapeHtml(registro.codigo_validacao)}
            </span>
          </div>

          <div class="data-row">
            <span class="data-label">Tipo de Documento:</span>
            <span class="data-val">${escapeHtml(tipoDocFmt)} ${registro.doc_numero ? `(Nº ${escapeHtml(registro.doc_numero)})` : ''}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Empresa responsável pelo registro:</span>
            <span class="data-val">${escapeHtml(registro.empresa || 'Empresa usuária do FinObra')} ${registro.empresa_cnpj ? `&bull; CNPJ ${escapeHtml(registro.empresa_cnpj)}` : ''}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Signatário:</span>
            <span class="data-val" style="color:#6ee7b7;font-weight:700;font-size:.95rem;">${escapeHtml(registro.nome)}</span>
          </div>
          <div class="data-row">
            <span class="data-label">CPF / CNPJ:</span>
            <span class="data-val">${escapeHtml(registro.doc)}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Papel / Qualificação:</span>
            <span class="data-val">${escapeHtml(registro.papel || 'Signatário')}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Data e Hora do Registro:</span>
            <span class="data-val">${escapeHtml(registro.data_hora_fmt)}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Dispositivo de Registro:</span>
            <span class="data-val" style="font-size:.8rem;color:#cbd5e1;">${escapeHtml(registro.ip_dispositivo || 'Navegador Web')}</span>
          </div>
          <div class="data-row">
            <span class="data-label">Status do Registro:</span>
            ${statusAuditHtml}
          </div>
        </div>

        <!-- Hash SHA-256 -->
        <div class="hash-box">
          <div class="hash-box-top">
            <span class="hash-box-title">🔒 Hash SHA-256 do Registro</span>
            <button class="btn-copy" id="btn-copy-hash">
              Copiar Hash
            </button>
          </div>
          <div class="hash-content">${escapeHtml(registro.hash_sha256)}</div>
        </div>

        <!-- Validação Cruzada QR Code e Base Legal -->
        <div class="legal-card">
          <img src="${qrCodeUrl}" alt="QR Code" class="legal-qr">
          <div class="legal-text">
            <strong>🔎 O que esta consulta confirma:</strong><br>
            Esta consulta confirma que o código exibido foi registrado na base central do FinObra e que os metadados acima correspondem ao registro eletrônico armazenado. O hash SHA-256 exibido protege a integridade do <strong>registro de assinatura</strong>. A validade jurídica do documento deve ser analisada conforme o contexto, a identificação das partes e os requisitos legais aplicáveis.
          </div>
        </div>

        <!-- Botões de Ação -->
        <div class="actions-row">
          <button class="btn-action" data-fb-click="Patch26Actions.print" data-fb-click-n="0">
            🖨️ Imprimir Consulta
          </button>
          <button class="btn-action" id="btn-copy-link">
            🔗 Copiar Link de Validação
          </button>
          <button class="btn-action btn-action-primary" data-fb-click="novaConsulta" data-fb-click-n="0">
            🔍 Nova Consulta
          </button>
        </div>
      `;

      // Listeners seguros sem eval ou injeção em atributos inline
      const btnCopyHash = document.getElementById('btn-copy-hash');
      if (btnCopyHash) {
        btnCopyHash.onclick = () => {
          navigator.clipboard.writeText(registro.hash_sha256 || '');
          alert('Hash copiado com sucesso!');
        };
      }
      const btnCopyLink = document.getElementById('btn-copy-link');
      if (btnCopyLink) {
        btnCopyLink.onclick = () => {
          copiarLink(registro.codigo_validacao);
        };
      }
    }

    function copiarLink(cod) {
      const url = window.location.origin + window.location.pathname + '?val=' + encodeURIComponent(cod);
      navigator.clipboard.writeText(url);
      alert('Link direto de validação copiado com sucesso:\n' + url);
    }

    function novaConsulta() {
      const input = document.getElementById('input-codigo');
      input.value = '';
      input.focus();
      document.getElementById('resultado-container').innerHTML = `
        <div class="idle-card">
          <div class="idle-icon">📜</div>
          <div class="idle-text">
            Insira o código verificador no campo acima e clique em <strong>Consultar</strong>.
          </div>
        </div>
      `;
    }

    // Ao carregar a página, verifica se há parâmetros na URL
    window.addEventListener('DOMContentLoaded', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const val = urlParams.get('val') || urlParams.get('codigo');
      if (val) {
        const input = document.getElementById('input-codigo');
        if (input) {
          input.value = val;
          executarBusca();
        }
      }
    });
