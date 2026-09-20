import { Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import React from 'react';
import { BRAND } from './brand';
import { CanalIntro } from './CanalIntro';
import { CanalOutro } from './CanalOutro';

export interface TutorialVideoProps {
  numero?: number;
  titulo?: string;
  modulo?: string;
  nivel?: string;
  duracao?: string;
  passos?: string[];
  dica?: string;
}

export const TutorialVideo: React.FC<TutorialVideoProps> = ({
  numero = 1,
  titulo = 'Como Iniciar uma Obra, Cadastrar Clientes e Etapas',
  modulo = 'Obras & Clientes',
  nivel = 'Iniciante',
  duracao = '4 min',
  passos = [
    'Acesse o menu lateral e clique em Obras & Clientes.',
    'Clique no botão + Nova Obra no canto superior direito.',
    'Preencha Razão Social, CPF/CNPJ e Engenheiro Responsável.',
    'Defina as datas previstas de início/término e valor total.',
    'Clique em Salvar Obra para gerar o cronograma.',
  ],
  dica = 'Definir o número do contrato de financiamento (Caixa) agiliza a aprovação das medições.',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: BRAND.colors.void,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ── 1. VINHETA DE ABERTURA (0 a 150 frames = 5 segundos) ────── */}
      <Sequence from={0} durationInFrames={150}>
        <CanalIntro />
      </Sequence>

      {/* ── 2. APRESENTAÇÃO DO TEMA DA AULA (150 a 450 frames = 10 segundos) ── */}
      <Sequence from={150} durationInFrames={300}>
        <SceneApresentacao
          numero={numero}
          titulo={titulo}
          modulo={modulo}
          nivel={nivel}
          duracao={duracao}
        />
      </Sequence>

      {/* ── 3. PASSO A PASSO ANIMADO (450 a 1050 frames = 20 segundos) ── */}
      <Sequence from={450} durationInFrames={600}>
        <ScenePassos passos={passos} modulo={modulo} />
      </Sequence>

      {/* ── 4. DICA DE OURO DA ENGENHARIA (1050 a 1350 frames = 10 segundos) ── */}
      <Sequence from={1050} durationInFrames={300}>
        <SceneDica dica={dica} modulo={modulo} />
      </Sequence>

      {/* ── 5. VINHETA DE ENCERRAMENTO (1350 a 1530 frames = 6 segundos) ── */}
      <Sequence from={1350} durationInFrames={180}>
        <CanalOutro />
      </Sequence>
    </div>
  );
};

// ── CENA 2: APRESENTAÇÃO DO TEMA ──────────────────────────────────────────────
const SceneApresentacao: React.FC<{
  numero: number;
  titulo: string;
  modulo: string;
  nivel: string;
  duracao: string;
}> = ({ numero, titulo, modulo, nivel, duracao }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20, 280, 300], [0, 1, 1, 0]);
  const translateY = interpolate(frame, [0, 30], [30, 0], {
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
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 120px',
        boxSizing: 'border-box',
        opacity,
        position: 'relative',
      }}
    >
      {/* Grid */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(198, 255, 0, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(198, 255, 0, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          transform: `translateY(${translateY}px)`,
          textAlign: 'center',
          maxWidth: '1200px',
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(198, 255, 0, 0.12)',
            border: '1px solid rgba(198, 255, 0, 0.4)',
            color: BRAND.colors.acid,
            padding: '8px 24px',
            borderRadius: '4px',
            fontFamily: BRAND.fonts.mono,
            fontSize: '1.1rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            marginBottom: '28px',
          }}
        >
          <span>🎓 AULA #{String(numero).padStart(2, '0')}</span>
          <span>•</span>
          <span>{modulo}</span>
          <span>•</span>
          <span>{nivel}</span>
        </div>

        <h1
          style={{
            fontSize: '4.2rem',
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1.1,
            margin: '0 0 24px',
            letterSpacing: '-0.02em',
            textTransform: 'uppercase',
          }}
        >
          {titulo}
        </h1>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            color: BRAND.colors.silver,
            fontSize: '1.2rem',
            fontFamily: BRAND.fonts.mono,
          }}
        >
          <span>⏱ TEMPO ESTIMADO: <strong style={{ color: BRAND.colors.acid }}>{duracao}</strong></span>
          <span>•</span>
          <span>PLATAFORMA: <strong style={{ color: '#fff' }}>FinGo Web & Mobile</strong></span>
        </div>
      </div>
    </div>
  );
};

// ── CENA 3: PASSO A PASSO ANIMADO ─────────────────────────────────────────────
const ScenePassos: React.FC<{ passos: string[]; modulo: string }> = ({ passos, modulo }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20, 580, 600], [0, 1, 1, 0]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: BRAND.colors.void,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 120px',
        boxSizing: 'border-box',
        opacity,
        position: 'relative',
      }}
    >
      {/* Header técnico */}
      <div
        style={{
          position: 'absolute',
          top: '60px',
          left: '120px',
          right: '120px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px' }}>
            <Img src={staticFile('fingo-symbol.png')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
          <span style={{ fontWeight: 900, color: '#fff', fontSize: '1.1rem', letterSpacing: '0.04em' }}>
            FINGO <span style={{ color: BRAND.colors.acid }}>// PASSO A PASSO DE EXECUÇÃO</span>
          </span>
        </div>
        <div style={{ fontFamily: BRAND.fonts.mono, color: BRAND.colors.mist, fontSize: '0.95rem' }}>
          MÓDULO: <strong style={{ color: BRAND.colors.acid }}>{modulo}</strong>
        </div>
      </div>

      {/* Lista de Passos com entrada sequencial */}
      <div
        style={{
          width: '100%',
          maxWidth: '1100px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          marginTop: '60px',
        }}
      >
        {passos.slice(0, 5).map((p, idx) => {
          const stepDelay = 30 + idx * 80;
          const stepProgress = interpolate(frame, [stepDelay, stepDelay + 25], [0, 1], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const stepX = interpolate(stepProgress, [0, 1], [-40, 0]);

          return (
            <div
              key={idx}
              style={{
                opacity: stepProgress,
                transform: `translateX(${stepX}px)`,
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                background: 'rgba(26, 26, 26, 0.8)',
                border: '1px solid rgba(198, 255, 0, 0.25)',
                borderRadius: '8px',
                padding: '18px 24px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: 'rgba(198, 255, 0, 0.15)',
                  border: '2px solid var(--accent)',
                  color: BRAND.colors.acid,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1.25rem',
                  fontFamily: BRAND.fonts.mono,
                  flexShrink: 0,
                }}
              >
                {idx + 1}
              </div>

              <div
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  lineHeight: 1.35,
                  flex: 1,
                }}
                dangerouslySetInnerHTML={{ __html: p }}
              />

              <div
                style={{
                  color: BRAND.colors.acid,
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  opacity: stepProgress,
                }}
              >
                ✓
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── CENA 4: DICA DE OURO DA ENGENHARIA ────────────────────────────────────────
const SceneDica: React.FC<{ dica: string; modulo: string }> = ({ dica, modulo }) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 20, 280, 300], [0, 1, 1, 0]);
  const scale = interpolate(frame, [10, 35], [0.92, 1], {
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
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '80px 120px',
        boxSizing: 'border-box',
        opacity,
        position: 'relative',
      }}
    >
      <div
        style={{
          maxWidth: '1000px',
          background: 'rgba(201, 162, 39, 0.08)',
          border: '2px solid #C9A227',
          borderRadius: '12px',
          padding: '48px 56px',
          textAlign: 'center',
          transform: `scale(${scale})`,
          boxShadow: '0 16px 60px rgba(201, 162, 39, 0.25)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '3rem',
            marginBottom: '16px',
          }}
        >
          💡
        </div>

        <div
          style={{
            fontSize: '1.2rem',
            fontWeight: 900,
            color: '#C9A227',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            fontFamily: BRAND.fonts.mono,
            marginBottom: '16px',
          }}
        >
          Dica de Ouro de Engenharia
        </div>

        <p
          style={{
            fontSize: '1.8rem',
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.45,
            margin: '0 0 24px',
          }}
        >
          "{dica}"
        </p>

        <div
          style={{
            fontSize: '1rem',
            color: BRAND.colors.mist,
            fontFamily: BRAND.fonts.mono,
          }}
        >
          FINANÇAS & ENGENHARIA // {modulo}
        </div>
      </div>
    </div>
  );
};
