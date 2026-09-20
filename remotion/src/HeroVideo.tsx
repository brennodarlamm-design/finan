import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';

export const HeroVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── 1. CINEMATIC CAMERA ZOOM & MOTION ───────────────────────────
  // Slow cinematic creep (1.0 to 1.04)
  const cameraZoom = interpolate(frame, [0, 300], [1.0, 1.04], {
    easing: Easing.bezier(0.25, 1, 0.5, 1),
  });

  // ── 2. REVEAL TIMINGS ───────────────────────────────────────────
  // A. Top Bar Reveal (frames 10 to 45)
  const topBarReveal = interpolate(frame, [10, 45], [0, 100], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // B. Phrases on the Left Reveal (frames 30 to 105) - sweeps from left to right
  const phraseReveal = interpolate(frame, [30, 105], [0, 100], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Position of the vertical laser scanning the phrases
  const phraseLaserX = phraseReveal; // 0% to 100% of left side

  // C. Construction Structure on the Right Reveal (frames 20 to 115) - rises from bottom to top
  const constructionRise = interpolate(frame, [20, 115], [0, 100], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Position of the horizontal laser scanner riding the top of the rising building
  const constructionLaserY = 100 - constructionRise;

  // D. FinGo Neon Logo Glow (frames 50 to 120)
  const logoPulse = interpolate(frame, [50, 90], [0.3, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const logoBreathing = interpolate(Math.sin((frame - 90) * 0.08), [-1, 1], [0.75, 1.05]);

  // E. Module Cards Target Highlights (frames 100 to 240)
  const card1Active = frame >= 95 && frame <= 145;
  const card2Active = frame >= 125 && frame <= 175;
  const card3Active = frame >= 155 && frame <= 205;
  const card4Active = frame >= 185 && frame <= 235;

  // F. CTA Button Neon Sweep (every 90 frames after frame 90)
  const ctaCycle = (frame - 90) % 90;
  const ctaSweepProgress = frame >= 90 ? interpolate(ctaCycle, [0, 40], [-50, 150], { extrapolateRight: 'clamp' }) : -100;

  // G. Ambient scanline loop
  const ambientScanY = interpolate(frame % 150, [0, 150], [-5, 105]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0A0A0A',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Courier New', Courier, monospace",
      }}
    >
      {/* ── LAYER 0: CAD BLUEPRINT WIREFRAME (Initial State) ───────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, #161614 0%, #10100E 50%, #0A0A09 100%)',
        }}
      >
        {/* Isometric CAD Grid */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(to right, rgba(198, 255, 0, 0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(198, 255, 0, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Blueprint elevation measurements on far left */}
        <div
          style={{
            position: 'absolute',
            left: '24px',
            top: '22%',
            bottom: '22%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: 'rgba(198, 255, 0, 0.28)',
            letterSpacing: '0.12em',
          }}
        >
          <span>LVL +24.00m // COBERTURA</span>
          <span>LVL +18.00m // LAJE 04</span>
          <span>LVL +12.00m // LAJE 03</span>
          <span>LVL +06.00m // LAJE 02</span>
          <span>LVL +00.00m // FUNDAÇÃO</span>
        </div>

        {/* Blueprint system status top left */}
        <div
          style={{
            position: 'absolute',
            top: '24px',
            left: '24px',
            fontSize: '11px',
            color: 'rgba(198, 255, 0, 0.45)',
            letterSpacing: '0.14em',
            fontWeight: 700,
          }}
        >
          [ PROTOCOLO FINGO // ESTRUTURA EM FLUXO ]
        </div>
      </div>

      {/* ── LAYER 1: BASE IMAGE CONTAINER WITH CAMERA ZOOM ────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `scale(${cameraZoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* ── 1A: REVEAL OF THE CONSTRUCTION STRUCTURE (RIGHT HALF) ── */}
        {/* The building rises from bottom up via clipPath */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `polygon(
              46% ${100 - constructionRise}%,
              100% ${100 - constructionRise}%,
              100% 100%,
              46% 100%
            )`,
          }}
        >
          <Img
            src={staticFile('hero-construction-base.jpg')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* ── 1B: REVEAL OF THE PHRASES & HEADLINE (LEFT HALF) ─────── */}
        {/* The headline and text reveal from left to right */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `polygon(
              0 0,
              ${Math.min(phraseReveal * 0.52, 48)}% 0,
              ${Math.min(phraseReveal * 0.52, 48)}% 100%,
              0 100%
            )`,
          }}
        >
          <Img
            src={staticFile('hero-construction-base.jpg')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
            from={-14}
          />
        </div>

        {/* ── 1C: REVEAL OF THE TOP HEADER BAR ─────────────────────── */}
        {/* The top bar and neon accent wipe from left to right */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            clipPath: `polygon(
              0 0,
              ${topBarReveal}% 0,
              ${topBarReveal}% 12%,
              0 12%
            )`,
          }}
        >
          <Img
            src={staticFile('hero-construction-base.jpg')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* ── 1D: FINAL FULL REVEAL AFTER FRAME 115 (SEAMLESS COMPOSITION) ── */}
        {frame >= 115 && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: interpolate(frame, [115, 125], [0, 1], { extrapolateRight: 'clamp' }),
            }}
          >
            <Img
              src={staticFile('hero-construction-base.jpg')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* ── 2. LASER SCANNER: RISING ON TOP OF THE CONSTRUCTION ─── */}
        {constructionRise > 0 && constructionRise < 99 && (
          <div
            style={{
              position: 'absolute',
              top: `${constructionLaserY}%`,
              left: '46%',
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #FFFFFF 0%, #C6FF00 20%, #C6FF00 80%, #FFFFFF 100%)',
              boxShadow: '0 0 16px #C6FF00, 0 0 35px rgba(198, 255, 0, 0.9)',
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 24px',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                fontWeight: 900,
                color: '#0A0A0A',
                backgroundColor: '#C6FF00',
                padding: '2px 8px',
                borderRadius: '2px',
                letterSpacing: '0.12em',
                transform: 'translateY(-14px)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              ELEVAÇÃO ESTRUTURAL // {Math.floor(constructionRise)}%
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 900,
                color: '#0A0A0A',
                backgroundColor: '#C6FF00',
                padding: '2px 8px',
                borderRadius: '2px',
                letterSpacing: '0.12em',
                transform: 'translateY(-14px)',
              }}
            >
              CANTEIRO ATIVO
            </span>
          </div>
        )}

        {/* ── 3. LASER SCANNER: SWEEPING ACROSS THE PHRASES ────────── */}
        {phraseReveal > 0 && phraseReveal < 98 && (
          <div
            style={{
              position: 'absolute',
              top: '12%',
              bottom: '10%',
              left: `${phraseLaserX * 0.48}%`,
              width: '3px',
              background: 'linear-gradient(180deg, transparent 0%, #C6FF00 30%, #FFFFFF 50%, #C6FF00 70%, transparent 100%)',
              boxShadow: '0 0 16px #C6FF00, 0 0 30px rgba(198, 255, 0, 0.8)',
              zIndex: 20,
            }}
          />
        )}

        {/* ── 4. LIGHT SWEEP OVER "QUE CONSTRÓI" HEADLINE ─────────── */}
        {frame >= 60 && frame <= 140 && (
          <div
            style={{
              position: 'absolute',
              top: '23%',
              left: `${interpolate(frame, [60, 140], [2, 42])}%`,
              width: '100px',
              height: '16%',
              background: 'linear-gradient(90deg, transparent 0%, rgba(198, 255, 0, 0.45) 50%, transparent 100%)',
              transform: 'skewX(-25deg)',
              pointerEvents: 'none',
              filter: 'blur(8px)',
              zIndex: 15,
            }}
          />
        )}

        {/* ── 5. HUD TARGET BOXES OVER THE 4 MODULE CARDS ─────────── */}
        {/* Card 1: Orçamentos & SINAPI (Top-Left of 2x2 grid) */}
        {card1Active && (
          <div
            style={{
              position: 'absolute',
              top: '59.5%',
              left: '54.5%',
              width: '20.5%',
              height: '16%',
              border: '2px solid #C6FF00',
              boxShadow: '0 0 22px rgba(198, 255, 0, 0.5), inset 0 0 14px rgba(198, 255, 0, 0.15)',
              pointerEvents: 'none',
              zIndex: 22,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'flex-start',
              padding: '4px 6px',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: 900,
                color: '#0A0A0A',
                backgroundColor: '#C6FF00',
                padding: '1px 5px',
                borderRadius: '1px',
                letterSpacing: '0.1em',
              }}
            >
              [ SYNC SINAPI: OK ]
            </span>
          </div>
        )}

        {/* Card 2: Medições em Campo (Top-Right of 2x2 grid) */}
        {card2Active && (
          <div
            style={{
              position: 'absolute',
              top: '59.5%',
              left: '76.5%',
              width: '20.5%',
              height: '16%',
              border: '2px solid #C6FF00',
              boxShadow: '0 0 22px rgba(198, 255, 0, 0.5), inset 0 0 14px rgba(198, 255, 0, 0.15)',
              pointerEvents: 'none',
              zIndex: 22,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'flex-start',
              padding: '4px 6px',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: 900,
                color: '#0A0A0A',
                backgroundColor: '#C6FF00',
                padding: '1px 5px',
                borderRadius: '1px',
                letterSpacing: '0.1em',
              }}
            >
              [ CANTEIRO REAL: LIVE ]
            </span>
          </div>
        )}

        {/* Card 3: Gestão Financeira (Bottom-Left of 2x2 grid) */}
        {card3Active && (
          <div
            style={{
              position: 'absolute',
              top: '77.5%',
              left: '54.5%',
              width: '20.5%',
              height: '16%',
              border: '2px solid #C6FF00',
              boxShadow: '0 0 22px rgba(198, 255, 0, 0.5), inset 0 0 14px rgba(198, 255, 0, 0.15)',
              pointerEvents: 'none',
              zIndex: 22,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'flex-start',
              padding: '4px 6px',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: 900,
                color: '#0A0A0A',
                backgroundColor: '#C6FF00',
                padding: '1px 5px',
                borderRadius: '1px',
                letterSpacing: '0.1em',
              }}
            >
              [ FLUXO DE CAIXA: ATIVO ]
            </span>
          </div>
        )}

        {/* Card 4: Multi-Obras Cloud (Bottom-Right of 2x2 grid) */}
        {card4Active && (
          <div
            style={{
              position: 'absolute',
              top: '77.5%',
              left: '76.5%',
              width: '20.5%',
              height: '16%',
              border: '2px solid #C6FF00',
              boxShadow: '0 0 22px rgba(198, 255, 0, 0.5), inset 0 0 14px rgba(198, 255, 0, 0.15)',
              pointerEvents: 'none',
              zIndex: 22,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'flex-start',
              padding: '4px 6px',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: 900,
                color: '#0A0A0A',
                backgroundColor: '#C6FF00',
                padding: '1px 5px',
                borderRadius: '1px',
                letterSpacing: '0.1em',
              }}
            >
              [ ECOSSISTEMA MULTI-OBRAS ]
            </span>
          </div>
        )}

        {/* ── 6. NEON GLOW OVER FINGO LOGO (TOP RIGHT) ─────────────── */}
        {frame >= 50 && (
          <div
            style={{
              position: 'absolute',
              top: '11%',
              right: '4.5%',
              width: '12%',
              height: '22%',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(198, 255, 0, 0.35) 0%, rgba(198, 255, 0, 0.08) 50%, transparent 70%)',
              opacity: logoPulse * logoBreathing,
              pointerEvents: 'none',
              zIndex: 15,
            }}
          />
        )}

        {/* ── 7. NEON LIGHT SWEEP ON CTA BUTTON "EXPERIMENTAR FINGO →" ─ */}
        {frame >= 90 && (
          <div
            style={{
              position: 'absolute',
              bottom: '16.5%',
              left: '5.2%',
              width: '18%',
              height: '7%',
              overflow: 'hidden',
              pointerEvents: 'none',
              zIndex: 16,
              borderRadius: '2px',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${ctaSweepProgress}%`,
                width: '40px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.7) 50%, transparent 100%)',
                transform: 'skewX(-20deg)',
              }}
            />
          </div>
        )}

        {/* ── 8. SUBTLE AMBIENT SCANLINE (CONTINUOUS CINEMATIC SCAN) ─ */}
        <div
          style={{
            position: 'absolute',
            top: `${ambientScanY}%`,
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(198, 255, 0, 0.15) 30%, rgba(198, 255, 0, 0.5) 50%, rgba(198, 255, 0, 0.15) 70%, transparent 100%)',
            opacity: 0.6,
            pointerEvents: 'none',
            zIndex: 18,
          }}
        />
      </div>
    </div>
  );
};

