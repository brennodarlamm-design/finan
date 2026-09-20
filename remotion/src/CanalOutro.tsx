import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { BRAND } from './brand';

export const CanalOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Fade-in inicial
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slide dos elementos
  const slideLeft = interpolate(frame, [10, 35], [-40, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cardsScale = interpolate(frame, [25, 50], [0.92, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: BRAND.colors.void,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '80px 100px',
        position: 'relative',
        opacity,
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
      }}
    >
      {/* Background Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(198, 255, 0, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(198, 255, 0, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
          pointerEvents: 'none',
        }}
      />

      {/* Glow */}
      <div
        style={{
          position: 'absolute',
          left: '100px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          backgroundColor: BRAND.colors.acid,
          filter: 'blur(220px)',
          opacity: 0.12,
          pointerEvents: 'none',
        }}
      />

      {/* Lado Esquerdo: Marca, CTA e Link */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          transform: `translateX(${slideLeft}px)`,
          zIndex: 2,
          maxWidth: '560px',
        }}
      >
        {/* Logo Oficial FinGo */}
        <div style={{ width: '280px', marginBottom: '24px' }}>
          <Img
            src={staticFile('fingo-logo-full.png')}
            style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        <h2
          style={{
            fontSize: '2.4rem',
            fontWeight: 900,
            color: '#fff',
            margin: '0 0 12px',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
          }}
        >
          OBRAS EM FLUXO. <br />
          <span style={{ color: BRAND.colors.acid }}>SEM PLANILHAS.</span>
        </h2>

        <p
          style={{
            fontSize: '1.1rem',
            color: BRAND.colors.silver,
            lineHeight: 1.5,
            margin: '0 0 28px',
          }}
        >
          Inscreva-se no canal para dominar gestão de obras, SINAPI, medições Caixa e BIM 3D.
        </p>

        {/* Botão / Link para o App */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 28px',
            background: BRAND.colors.acid,
            color: '#0A0A0A',
            fontWeight: 900,
            fontSize: '1.1rem',
            borderRadius: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            boxShadow: '0 0 30px rgba(198, 255, 0, 0.4)',
          }}
        >
          <span>🚀 TESTE GRÁTIS: fingo.api.br</span>
        </div>

        <div
          style={{
            marginTop: '20px',
            fontFamily: BRAND.fonts.mono,
            fontSize: '13px',
            color: BRAND.colors.mist,
            letterSpacing: '0.1em',
          }}
        >
          DISPONÍVEL PARA WEB & MOBILE • PWA OFFLINE
        </div>
      </div>

      {/* Lado Direito: Espaços Reservados para End Screen do YouTube */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          alignItems: 'flex-end',
          transform: `scale(${cardsScale})`,
          zIndex: 2,
        }}
      >
        {/* Placeholder para Vídeo Recomendado (16:9) */}
        <div
          style={{
            width: '480px',
            height: '270px',
            background: 'rgba(26, 26, 26, 0.7)',
            border: '2px dashed rgba(198, 255, 0, 0.4)',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: BRAND.colors.acid,
            fontFamily: BRAND.fonts.mono,
            fontSize: '14px',
            letterSpacing: '0.1em',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span style={{ fontSize: '2.5rem', marginBottom: '8px' }}>▶</span>
          <span>[ VÍDEO RECOMENDADO ]</span>
          <span style={{ fontSize: '11px', color: BRAND.colors.mist, marginTop: '4px' }}>
            SLOT AUTOMÁTICO DO YOUTUBE
          </span>
        </div>

        {/* Placeholder para Botão de Inscrição */}
        <div
          style={{
            width: '480px',
            height: '110px',
            background: 'rgba(26, 26, 26, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '2px dashed var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}
          >
            🔔
          </div>
          <div>
            <div style={{ fontWeight: 800, color: '#fff', fontSize: '1rem' }}>
              INSCREVA-SE NO CANAL
            </div>
            <div style={{ fontSize: '12px', color: BRAND.colors.mist, marginTop: '2px' }}>
              Ative o sininho para novos tutoriais semanais
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
