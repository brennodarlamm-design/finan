import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { BRAND } from './brand';

export const LogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Background fade-in
  const bgOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Grid and HUD opacity
  const hudOpacity = interpolate(frame, [5, 30], [0, 0.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 1: Bracket enters from top-left (frame 10 -> 40)
  const bracketProgress = interpolate(frame, [10, 42], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bracketTranslate = interpolate(bracketProgress, [0, 1], ['-90px -90px', '0px 0px']);
  const bracketOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 1: Arrow enters from bottom-right (frame 14 -> 46)
  const arrowProgress = interpolate(frame, [14, 46], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const arrowTranslate = interpolate(arrowProgress, [0, 1], ['90px 90px', '0px 0px']);
  const arrowOpacity = interpolate(frame, [14, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Kinetic snap flash when both pieces lock together (frame 44 -> 60)
  const lockFlash = interpolate(frame, [43, 47, 65], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Symbol subtle scale bounce on impact
  const symbolScale = interpolate(frame, [0, 42, 48, 70], [0.92, 0.96, 1.04, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    output: 'perceptual-scale',
  });

  // Phase 2: 'FinGo' wordmark reveal (frame 50 -> 85)
  const wordmarkOpacity = interpolate(frame, [50, 78], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordmarkTranslate = interpolate(frame, [50, 82], ['0px 35px', '0px 0px'], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const wordmarkScale = interpolate(frame, [50, 82], [0.94, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    output: 'perceptual-scale',
  });

  // Phase 3: 'OBRAS EM FLUXO' tagline reveal (frame 72 -> 110)
  const taglineOpacity = interpolate(frame, [72, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineTranslate = interpolate(frame, [72, 104], ['0px 20px', '0px 0px'], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineLetterSpacing = interpolate(frame, [72, 115], ['0.2em', '0.45em'], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Phase 4: Neon technical accent line (frame 95 -> 135)
  const lineWidth = interpolate(frame, [95, 135], [0, 320], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lineOpacity = interpolate(frame, [95, 115], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ambient breathing pulse after lock
  const ambientGlow = interpolate(
    Math.sin((frame - 60) / 10),
    [-1, 1],
    [0.35, 0.75]
  );

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
        opacity: bgOpacity,
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
          backgroundSize: '80px 80px',
          backgroundPosition: 'center center',
          opacity: hudOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Technical HUD Crosshairs at corners */}
      <div
        style={{
          position: 'absolute',
          top: '60px',
          left: '60px',
          color: BRAND.colors.acid,
          fontFamily: BRAND.fonts.mono,
          fontSize: '14px',
          opacity: hudOpacity,
          letterSpacing: '0.15em',
        }}
      >
        + FINGO // BRUTALIST_CORE_v4
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '60px',
          right: '60px',
          color: BRAND.colors.mist,
          fontFamily: BRAND.fonts.mono,
          fontSize: '13px',
          opacity: hudOpacity,
          letterSpacing: '0.1em',
        }}
      >
        SYS.2026 // [1080x1080]
      </div>

      {/* Ambient Neon Backlight Glow */}
      <div
        style={{
          position: 'absolute',
          width: '520px',
          height: '520px',
          borderRadius: '50%',
          backgroundColor: BRAND.colors.acid,
          filter: 'blur(160px)',
          opacity: frame >= 40 ? ambientGlow * 0.18 + lockFlash * 0.4 : 0,
          pointerEvents: 'none',
        }}
      />

      {/* Symbol Container: Kinetic snap together */}
      <div
        style={{
          position: 'relative',
          width: '380px',
          height: '360px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          scale: symbolScale,
          filter: `drop-shadow(0 0 ${20 + lockFlash * 40}px rgba(198, 255, 0, ${0.4 + lockFlash * 0.6}))`,
        }}
      >
        {/* Top-Left Bracket */}
        <Img
          src={staticFile('fingo-symbol-bracket.png')}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            translate: bracketTranslate,
            opacity: bracketOpacity,
          }}
        />

        {/* Bottom-Right Arrow */}
        <Img
          src={staticFile('fingo-symbol-arrow.png')}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            translate: arrowTranslate,
            opacity: arrowOpacity,
          }}
        />
      </div>

      {/* Wordmark Container: Official FinGo typography */}
      <div
        style={{
          marginTop: '45px',
          width: '460px',
          display: 'flex',
          justifyContent: 'center',
          opacity: wordmarkOpacity,
          translate: wordmarkTranslate,
          scale: wordmarkScale,
          filter: 'drop-shadow(0 4px 18px rgba(0, 0, 0, 0.8))',
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

      {/* Tagline Container: Official OBRAS EM FLUXO */}
      <div
        style={{
          marginTop: '20px',
          width: '440px',
          display: 'flex',
          justifyContent: 'center',
          opacity: taglineOpacity,
          translate: taglineTranslate,
        }}
      >
        <Img
          src={staticFile('fingo-tagline.png')}
          style={{
            width: '100%',
            height: 'auto',
            objectFit: 'contain',
            filter: 'brightness(1.1)',
          }}
        />
      </div>

      {/* Neon Industrial Accent Bar */}
      <div
        style={{
          marginTop: '34px',
          height: '3px',
          width: `${lineWidth}px`,
          backgroundColor: BRAND.colors.acid,
          opacity: lineOpacity,
          boxShadow: '0 0 16px rgba(198, 255, 0, 0.7)',
        }}
      />
    </div>
  );
};

