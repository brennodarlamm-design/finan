import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { BRAND } from './brand';

export const CanalIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Fade de entrada inicial
  const bgOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Grid e linhas técnicas
  const hudOpacity = interpolate(frame, [5, 25], [0, 0.45], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Animação das peças do símbolo oficial FinGo
  // Bracket entra pelo topo-esquerdo
  const bracketProgress = interpolate(frame, [10, 38], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bracketTranslate = interpolate(bracketProgress, [0, 1], ['-120px -120px', '0px 0px']);
  const bracketOpacity = interpolate(frame, [10, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Arrow entra pelo canto inferior-direito
  const arrowProgress = interpolate(frame, [14, 42], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const arrowTranslate = interpolate(arrowProgress, [0, 1], ['120px 120px', '0px 0px']);
  const arrowOpacity = interpolate(frame, [14, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Flash cinético do travamento do símbolo (lock impact)
  const lockFlash = interpolate(frame, [40, 44, 58], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Escala do símbolo
  const symbolScale = interpolate(frame, [0, 40, 46, 65], [0.9, 0.94, 1.05, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Revelação do Wordmark oficial 'FinGo'
  const wordmarkOpacity = interpolate(frame, [48, 72], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordmarkTranslate = interpolate(frame, [48, 76], ['0px 40px', '0px 0px'], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Revelação do Tagline 'OBRAS EM FLUXO'
  const taglineOpacity = interpolate(frame, [68, 92], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineTranslate = interpolate(frame, [68, 96], ['0px 25px', '0px 0px'], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Barra de acento neon ácido (#C6FF00)
  const lineWidth = interpolate(frame, [88, 120], [0, 480], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lineOpacity = interpolate(frame, [88, 105], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Badge do canal oficial (Canal YouTube Oficial)
  const badgeOpacity = interpolate(frame, [100, 125], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Transição de saída (Fade out suave no final para corte direto)
  const exitOpacity = interpolate(frame, [135, 150], [1, 0], {
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
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        opacity: bgOpacity * exitOpacity,
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Grid industrial técnico */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(198, 255, 0, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(198, 255, 0, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          backgroundPosition: 'center center',
          opacity: hudOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Marcações de HUD nos cantos (Full HD 1920x1080) */}
      <div
        style={{
          position: 'absolute',
          top: '60px',
          left: '80px',
          color: BRAND.colors.acid,
          fontFamily: BRAND.fonts.mono,
          fontSize: '15px',
          opacity: hudOpacity,
          letterSpacing: '0.15em',
        }}
      >
        + FINGO // CANAL OFICIAL
      </div>
      <div
        style={{
          position: 'absolute',
          top: '60px',
          right: '80px',
          color: BRAND.colors.mist,
          fontFamily: BRAND.fonts.mono,
          fontSize: '14px',
          opacity: hudOpacity,
          letterSpacing: '0.1em',
        }}
      >
        ENGENHARIA & TECNOLOGIA
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          left: '80px',
          color: BRAND.colors.mist,
          fontFamily: BRAND.fonts.mono,
          fontSize: '13px',
          opacity: hudOpacity,
          letterSpacing: '0.1em',
        }}
      >
        [4K/60FPS HDR] // 1920x1080
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          right: '80px',
          color: BRAND.colors.acid,
          fontFamily: BRAND.fonts.mono,
          fontSize: '13px',
          opacity: hudOpacity,
          letterSpacing: '0.1em',
        }}
      >
        ● REC // CANAL OFICIAL
      </div>

      {/* Brilho neon de fundo */}
      <div
        style={{
          position: 'absolute',
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          backgroundColor: BRAND.colors.acid,
          filter: 'blur(200px)',
          opacity: frame >= 40 ? 0.16 + lockFlash * 0.45 : 0,
          pointerEvents: 'none',
        }}
      />

      {/* Container do Símbolo Oficial FinGo */}
      <div
        style={{
          position: 'relative',
          width: '280px',
          height: '260px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${symbolScale})`,
          filter: `drop-shadow(0 0 ${24 + lockFlash * 48}px rgba(198, 255, 0, ${0.45 + lockFlash * 0.55}))`,
        }}
      >
        {/* Bracket Superior Esquerdo Oficial */}
        <Img
          src={staticFile('fingo-symbol-bracket.png')}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translate(${bracketTranslate})`,
            opacity: bracketOpacity,
          }}
        />

        {/* Arrow Inferior Direito Oficial */}
        <Img
          src={staticFile('fingo-symbol-arrow.png')}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: `translate(${arrowTranslate})`,
            opacity: arrowOpacity,
          }}
        />
      </div>

      {/* Wordmark Oficial 'FinGo' */}
      <div
        style={{
          marginTop: '35px',
          width: '420px',
          display: 'flex',
          justifyContent: 'center',
          opacity: wordmarkOpacity,
          transform: `translate(${wordmarkTranslate})`,
          filter: 'drop-shadow(0 6px 24px rgba(0, 0, 0, 0.9))',
        }}
      >
        <Img
          src={staticFile('fingo-wordmark.png')}
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Tagline Oficial 'OBRAS EM FLUXO' */}
      <div
        style={{
          marginTop: '16px',
          width: '400px',
          display: 'flex',
          justifyContent: 'center',
          opacity: taglineOpacity,
          transform: `translate(${taglineTranslate})`,
        }}
      >
        <Img
          src={staticFile('fingo-tagline.png')}
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
          }}
        />
      </div>

      {/* Linha de Acento Neon Ácido */}
      <div
        style={{
          marginTop: '28px',
          height: '4px',
          width: `${lineWidth}px`,
          backgroundColor: BRAND.colors.acid,
          opacity: lineOpacity,
          boxShadow: '0 0 20px rgba(198, 255, 0, 0.8)',
          borderRadius: '2px',
        }}
      />

      {/* Badge do Canal YouTube */}
      <div
        style={{
          marginTop: '22px',
          opacity: badgeOpacity,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '6px 16px',
          borderRadius: '4px',
          background: 'rgba(198, 255, 0, 0.08)',
          border: '1px solid rgba(198, 255, 0, 0.25)',
          color: BRAND.colors.acid,
          fontFamily: BRAND.fonts.mono,
          fontSize: '13px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        <span>▶</span> <span>TREINAMENTO OFICIAL & ENGENHARIA</span>
      </div>
    </div>
  );
};
