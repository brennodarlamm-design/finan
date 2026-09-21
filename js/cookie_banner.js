/**
 * FinGo — Banner Global de Cookies, Privacidade & Termos de Uso (LGPD)
 * Exibe modal/banner não intrusivo para consentimento de cookies essenciais e
 * aceite transparente dos Termos de Uso e Política de Privacidade (incluindo upload de arquivos).
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'fingo_cookie_consent_v2';

  function hasConsent() {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      if (!val) return false;
      const parsed = JSON.parse(val);
      return parsed && parsed.consented === true;
    } catch {
      return false;
    }
  }

  function saveConsent() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          consented: true,
          timestamp: new Date().toISOString(),
          version: '2.38'
        })
      );
    } catch (e) {
      console.warn('[FinGo Consent] Não foi possível persistir no localStorage:', e);
    }
  }

  function createBanner() {
    if (document.getElementById('fingo-cookie-banner')) return;

    const banner = document.createElement('aside');
    banner.id = 'fingo-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Consentimento de Cookies e Privacidade');
    banner.setAttribute('aria-live', 'polite');

    banner.innerHTML = `
      <style>
        #fingo-cookie-banner {
          position: fixed;
          bottom: 24px;
          right: 24px;
          max-width: 440px;
          width: calc(100% - 48px);
          background: #0A1108;
          border: 1px solid rgba(198, 255, 0, 0.28);
          border-radius: 12px;
          padding: 20px 22px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.85), 0 0 24px rgba(198, 255, 0, 0.08);
          z-index: 999999;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #F0EAD6;
          box-sizing: border-box;
          animation: fingoBannerFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        @keyframes fingoBannerFadeIn {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes fingoBannerFadeOut {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(16px) scale(0.97);
          }
        }
        #fingo-cookie-banner.closing {
          animation: fingoBannerFadeOut 0.25s ease-out forwards;
        }
        .fingo-cb-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        .fingo-cb-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(198, 255, 0, 0.12);
          border: 1px solid rgba(198, 255, 0, 0.35);
          color: #C6FF00;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 3px 8px;
          border-radius: 4px;
        }
        .fingo-cb-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: #FFFFFF;
        }
        .fingo-cb-text {
          font-size: 0.82rem;
          line-height: 1.55;
          color: #CBD5E1;
          margin: 0 0 16px 0;
        }
        .fingo-cb-text a {
          color: #C6FF00;
          text-decoration: underline;
          text-underline-offset: 2px;
          font-weight: 600;
          transition: color 0.15s;
        }
        .fingo-cb-text a:hover {
          color: #E8C84A;
        }
        .fingo-cb-text a:focus,
        .fingo-cb-btn-accept:focus,
        .fingo-cb-btn-link:focus {
          outline: 3px solid #D4FF33;
          outline-offset: 3px;
        }
        .fingo-cb-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .fingo-cb-btn-accept {
          background: #C6FF00;
          color: #040804;
          border: none;
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          padding: 9px 18px;
          border-radius: 6px;
          cursor: pointer;
          transition: transform 0.12s, filter 0.12s, background 0.12s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .fingo-cb-btn-accept:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }
        .fingo-cb-btn-accept:active {
          transform: translateY(0);
        }
        .fingo-cb-btn-link {
          background: transparent;
          color: #94A3B8;
          border: 1px solid rgba(255, 255, 255, 0.12);
          font-size: 0.80rem;
          font-weight: 600;
          padding: 8px 14px;
          border-radius: 6px;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s;
        }
        .fingo-cb-btn-link:hover {
          color: #F0EAD6;
          border-color: rgba(198, 255, 0, 0.4);
          background: rgba(198, 255, 0, 0.05);
        }
        @media (max-width: 480px) {
          #fingo-cookie-banner {
            bottom: 12px;
            right: 12px;
            left: 12px;
            width: auto;
            padding: 16px;
          }
          .fingo-cb-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .fingo-cb-btn-accept, .fingo-cb-btn-link {
            width: 100%;
            min-height: 44px;
            text-align: center;
            justify-content: center;
          }
          .fingo-cb-text a {
            display: inline-flex;
            align-items: center;
            min-height: 44px;
          }
        }
      </style>
      <div class="fingo-cb-header">
        <span class="fingo-cb-badge">🛡️ LGPD &amp; Segurança</span>
        <span class="fingo-cb-title">Privacidade e Termos de Uso</span>
      </div>
      <p class="fingo-cb-text">
        Utilizamos cookies essenciais e tecnologias seguras para autenticação, isolamento dos dados da sua construtora e proteção de uploads de projetos e notas fiscais. Ao continuar, você concorda com nossos
        <a href="/termos" target="_blank" rel="noopener">Termos de Uso</a> e nossa
        <a href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</a>.
      </p>
      <div class="fingo-cb-actions">
        <button id="fingo-cb-accept-btn" class="fingo-cb-btn-accept">Aceitar e Continuar</button>
        <a href="/privacidade" target="_blank" rel="noopener" class="fingo-cb-btn-link">Ver Políticas</a>
      </div>
    `;

    document.body.appendChild(banner);

    const acceptBtn = document.getElementById('fingo-cb-accept-btn');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        saveConsent();
        banner.classList.add('closing');
        setTimeout(() => {
          if (banner.parentNode) banner.parentNode.removeChild(banner);
        }, 260);
      });
    }
  }

  function init() {
    if (hasConsent()) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', createBanner);
    } else {
      createBanner();
    }
  }

  // Inicialização segura
  init();
})();
