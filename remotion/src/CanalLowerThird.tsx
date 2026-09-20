import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { BRAND } from './brand';

export interface CanalLowerThirdProps {
  nome?: string;
  cargo?: string;
  tema?: string;
}

export const CanalLowerThird: React.FC<CanalLowerThirdProps> = ({
  nome = 'Eng. Especialista',
  cargo = 'Gestão de Obras & Custos',
  tema = 'Tutorial FinGo',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animação de entrada (0 a 25 frames)
  const enterProgress = interpolate(frame, [0, 22], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Animação de saída (125 a 150 frames)
  const exitProgress = interpolate(frame, [125, 145], [0, 1], {
    easing: Easing.bezier(0.4, 0, 1, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateX = interpolate(enterProgress - exitProgress, [-1, 0, 1], [-600, -600, 0]);
  const opacity = interpolate(enterProgress - exitProgress, [-1, 0, 1], [0, 0, 1]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        pointerEvents: 'none',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Lower Third Container no canto inferior esquerdo */}
      <div
        style={{
          position: 'absolute',
          bottom: '80px',
          left: '80px',
          transform: `translateX(${translateX}px)`,
          opacity,
          display: 'flex',
          alignItems: 'stretch',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
          borderRadius: '6px',
          overflow: 'hidden',
        }}
      >
        {/* Barra Lateral Neon Verde Ácido com o Ícone Oficial FinGo */}
        <div
          style={{
            backgroundColor: BRAND.colors.acid,
            width: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px',
          }}
        >
          <Img
            src={staticFile('fingo-symbol.png')}
            style={{
              width: '46px',
              height: '46px',
              objectFit: 'contain',
              filter: 'brightness(0)', // preto sobre o fundo verde acido
            }}
          />
        </div>

        {/* Corpo com Nome, Cargo e Tag */}
        <div
          style={{
            backgroundColor: 'rgba(13, 13, 13, 0.95)',
            borderTop: '1px solid rgba(198, 255, 0, 0.3)',
            borderRight: '1px solid rgba(198, 255, 0, 0.3)',
            borderBottom: '1px solid rgba(198, 255, 0, 0.3)',
            padding: '16px 28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '4px',
            }}
          >
            <span
              style={{
                fontSize: '1.35rem',
                fontWeight: 900,
                color: '#fff',
                letterSpacing: '-0.01em',
              }}
            >
              {nome}
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                backgroundColor: 'rgba(198, 255, 0, 0.15)',
                color: BRAND.colors.acid,
                padding: '2px 8px',
                borderRadius: '3px',
                fontWeight: 800,
                textTransform: 'uppercase',
                fontFamily: BRAND.fonts.mono,
              }}
            >
              {tema}
            </span>
          </div>

          <div
            style={{
              fontSize: '0.9rem',
              color: BRAND.colors.silver,
              fontWeight: 500,
            }}
          >
            {cargo}
          </div>
        </div>
      </div>
    </div>
  );
};
