import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { BRAND } from './brand';

export const HeroVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Top accent neon line expansion
  const lineProgress = interpolate(frame, [0, 45], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateRight: 'clamp',
  });

  const words = ['TECNOLOGIA', 'QUE CONSTRÓI', 'O AMANHÃ.'];

  // Real FinGo mark scale and glow
  const iconProgress = interpolate(frame, [40, 80], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const iconScale = interpolate(iconProgress, [0, 1], [0.85, 1], {
    output: 'perceptual-scale',
  });
  const iconOpacity = interpolate(frame, [40, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const features = [
    { tag: '01', title: 'ORÇAMENTOS & SINAPI', stat: '99.8% PRECISÃO' },
    { tag: '02', title: 'MEDIÇÕES EM CAMPO', stat: 'TEMPO REAL' },
    { tag: '03', title: 'GESTÃO FINANCEIRA', stat: 'FLUXO AUTOMÁTICO' },
    { tag: '04', title: 'MULTI-OBRAS CLOUD', stat: 'SYNC INSTANTÂNEO' },
  ];

  const ctaOpacity = interpolate(frame, [170, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaTranslate = interpolate(frame, [170, 205], ['0px 20px', '0px 0px'], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const underlineScale = interpolate(frame, [195, 230], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background subtle grid
  const hudOpacity = interpolate(frame, [0, 30], [0, 0.35], {
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
        padding: '80px 100px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Industrial Grid Lines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          opacity: hudOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Top Header / Meta bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          fontFamily: BRAND.fonts.mono,
          fontSize: '15px',
          color: BRAND.colors.mist,
          letterSpacing: '0.12em',
          opacity: hudOpacity,
        }}
      >
        <span>FINGO.API.BR // ERP OPERACIONAL</span>
        <span style={{ color: BRAND.colors.acid }}>LIVE PROTOCOL 2026</span>
      </div>

      {/* Neon Line with scaleX */}
      <div
        style={{
          width: '100%',
          height: '3px',
          backgroundColor: BRAND.colors.acid,
          scale: `${lineProgress} 1`,
          transformOrigin: 'left',
          marginBottom: '60px',
          boxShadow: '0 0 20px rgba(198, 255, 0, 0.6)',
        }}
      />

      <div style={{ display: 'flex', flex: 1, position: 'relative', zIndex: 1 }}>
        {/* Left Column: Headlines & CTA */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {words.map((word, i) => {
              const startFrame = 25 + i * 18;
              const wordOpacity = interpolate(frame, [startFrame, startFrame + 22], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const wordTranslate = interpolate(
                frame,
                [startFrame, startFrame + 22],
                ['0px 30px', '0px 0px'],
                {
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }
              );

              return (
                <h1
                  key={i}
                  style={{
                    fontFamily: BRAND.fonts.display,
                    fontSize: i === 1 ? '92px' : '82px',
                    color: i === 1 ? BRAND.colors.acid : BRAND.colors.offwhite,
                    textTransform: 'uppercase',
                    lineHeight: '0.95',
                    margin: 0,
                    opacity: wordOpacity,
                    translate: wordTranslate,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {word}
                </h1>
              );
            })}
          </div>

          <p
            style={{
              marginTop: '35px',
              fontFamily: BRAND.fonts.mono,
              fontSize: '22px',
              color: BRAND.colors.silver,
              letterSpacing: '0.04em',
              maxWidth: '680px',
              lineHeight: '1.5',
              opacity: interpolate(frame, [70, 95], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            A plataforma definitiva de inteligência e controle de custos para construtoras e incorporadoras.
          </p>

          <div style={{ marginTop: 'auto', paddingTop: '40px', opacity: ctaOpacity, translate: ctaTranslate }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '16px',
                backgroundColor: BRAND.colors.acid,
                color: BRAND.colors.void,
                fontFamily: BRAND.fonts.display,
                fontSize: '26px',
                fontWeight: '700',
                letterSpacing: '0.06em',
                padding: '16px 36px',
                borderRadius: '4px',
                boxShadow: '0 0 30px rgba(198, 255, 0, 0.5)',
              }}
            >
              EXPERIMENTAR FINGO →
            </div>
          </div>
        </div>

        {/* Right Column: Authentic FinGo Mark & Grid of Features */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          {/* Authentic FinGo Symbol */}
          <div
            style={{
              opacity: iconOpacity,
              scale: iconScale,
              width: '200px',
              height: '190px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              filter: 'drop-shadow(0 0 35px rgba(198, 255, 0, 0.6))',
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

          {/* 2x2 Industrial Features Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', width: '100%', marginTop: '30px' }}>
            {features.map((feat, i) => {
              const startFrame = 80 + i * 22;
              const featOpacity = interpolate(frame, [startFrame, startFrame + 25], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const featTranslate = interpolate(frame, [startFrame, startFrame + 25], ['0px 25px', '0px 0px'], {
                easing: Easing.bezier(0.16, 1, 0.3, 1),
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });

              return (
                <div
                  key={feat.tag}
                  style={{
                    backgroundColor: BRAND.colors.deep,
                    border: `1px solid ${BRAND.colors.shadow}`,
                    borderLeft: `4px solid ${BRAND.colors.acid}`,
                    borderRadius: '4px',
                    padding: '24px 22px',
                    opacity: featOpacity,
                    translate: featTranslate,
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontFamily: BRAND.fonts.mono, color: BRAND.colors.acid, fontSize: '14px', fontWeight: 'bold' }}>
                      //{feat.tag}
                    </span>
                    <span style={{ fontFamily: BRAND.fonts.mono, color: BRAND.colors.mist, fontSize: '12px' }}>
                      {feat.stat}
                    </span>
                  </div>
                  <div style={{ fontFamily: BRAND.fonts.display, color: BRAND.colors.offwhite, fontSize: '20px', letterSpacing: '0.02em' }}>
                    {feat.title}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

