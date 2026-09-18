import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { BRAND } from './brand';

export const OGVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Entrance animations with Easing.bezier
  const logoOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const logoScale = interpolate(frame, [0, 30], [0.85, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    output: 'perceptual-scale',
  });

  const wordmarkOpacity = interpolate(frame, [20, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordmarkTranslate = interpolate(frame, [20, 50], ['0px 25px', '0px 0px'], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const taglineOpacity = interpolate(frame, [40, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineTranslate = interpolate(frame, [40, 70], ['0px 15px', '0px 0px'], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const badgeOpacity = interpolate(frame, [60, 85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const gridOpacity = interpolate(frame, [0, 40], [0, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: BRAND.colors.ink,
        display: 'flex',
        flexDirection: 'row',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Background Grid Pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: gridOpacity,
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Left 65%: Brand identity reveal */}
      <div
        style={{
          width: '65%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 100px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Top Micro-tag */}
        <div
          style={{
            fontFamily: BRAND.fonts.mono,
            color: BRAND.colors.acid,
            fontSize: '15px',
            letterSpacing: '0.2em',
            marginBottom: '35px',
            opacity: badgeOpacity,
          }}
        >
          + FINGO.API.BR // GESTÃO DE OBRAS & ORÇAMENTOS
        </div>

        {/* Authentic Symbol + Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '25px' }}>
          <div
            style={{
              width: '130px',
              height: '120px',
              opacity: logoOpacity,
              scale: logoScale,
              filter: 'drop-shadow(0 0 25px rgba(198, 255, 0, 0.6))',
            }}
          >
            <Img
              src={staticFile('fingo-symbol.png')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          </div>

          <div
            style={{
              width: '320px',
              opacity: wordmarkOpacity,
              translate: wordmarkTranslate,
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
        </div>

        {/* Tagline */}
        <div
          style={{
            width: '380px',
            opacity: taglineOpacity,
            translate: taglineTranslate,
            marginBottom: '35px',
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

        {/* Bottom Status pill */}
        <div style={{ opacity: badgeOpacity }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: 'rgba(198, 255, 0, 0.08)',
              border: `1px solid ${BRAND.colors.acid}`,
              padding: '8px 18px',
              borderRadius: '4px',
              fontFamily: BRAND.fonts.mono,
              fontSize: '14px',
              color: BRAND.colors.acid,
              letterSpacing: '0.08em',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: BRAND.colors.acid, boxShadow: '0 0 8px #C6FF00' }} />
            TECNOLOGIA PARA QUEM CONSTRÓI O AMANHÃ
          </div>
        </div>
      </div>

      {/* Right 35%: Brutalist Tech Visual Column */}
      <div
        style={{
          width: '35%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BRAND.colors.void,
          borderLeft: `1px solid ${BRAND.colors.shadow}`,
        }}
      >
        {/* Giant Watermark Symbol in background */}
        <div
          style={{
            position: 'absolute',
            width: '420px',
            height: '420px',
            opacity: 0.12,
            filter: 'grayscale(1) brightness(0.7)',
          }}
        >
          <Img
            src={staticFile('fingo-symbol.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </div>

        {/* Vertical Decorative Brutalist Text */}
        <div
          style={{
            opacity: taglineOpacity,
            rotate: '-90deg',
            fontFamily: BRAND.fonts.display,
            fontSize: '110px',
            color: 'transparent',
            WebkitTextStroke: `2px ${BRAND.colors.smoke}`,
            letterSpacing: '0.15em',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
          }}
        >
          FLUXO // ERP
        </div>
      </div>
    </div>
  );
};
