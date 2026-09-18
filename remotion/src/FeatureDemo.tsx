import { Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import React from 'react';
import { BRAND } from './brand';

const HeaderWatermark: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      position: 'absolute',
      top: '50px',
      left: '80px',
      right: '80px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: `1px solid ${BRAND.colors.shadow}`,
      paddingBottom: '20px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div style={{ width: '40px', height: '38px', filter: 'drop-shadow(0 0 12px rgba(198, 255, 0, 0.6))' }}>
        <Img src={staticFile('fingo-symbol.png')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      <span style={{ fontFamily: BRAND.fonts.display, fontSize: '24px', color: BRAND.colors.offwhite, letterSpacing: '0.04em' }}>
        FINGO <span style={{ color: BRAND.colors.acid }}>// OBRAS EM FLUXO</span>
      </span>
    </div>
    <div style={{ fontFamily: BRAND.fonts.mono, fontSize: '15px', color: BRAND.colors.mist, letterSpacing: '0.1em' }}>
      MÓDULO: <span style={{ color: BRAND.colors.acid }}>{label}</span>
    </div>
  </div>
);

const MedicoesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [20, 110], [0, 87.4], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 20], [0, 1], {
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
        opacity,
        position: 'relative',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <HeaderWatermark label="MEDIÇÕES DE CAMPO" />
      <h2 style={{ fontFamily: BRAND.fonts.display, color: BRAND.colors.offwhite, fontSize: '64px', marginBottom: '20px', letterSpacing: '-0.01em' }}>
        AVANÇO FÍSICO DA OBRA
      </h2>
      <div style={{ fontFamily: BRAND.fonts.mono, color: BRAND.colors.silver, fontSize: '20px', marginBottom: '45px' }}>
        TORRE RESIDENCIAL HORIZONTE // ETAPA 04 - ESTRUTURAL
      </div>

      <div
        style={{
          width: '900px',
          height: '32px',
          backgroundColor: BRAND.colors.deep,
          border: `1px solid ${BRAND.colors.smoke}`,
          borderRadius: '4px',
          padding: '4px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: BRAND.colors.acid,
            borderRadius: '2px',
            boxShadow: '0 0 20px rgba(198, 255, 0, 0.7)',
          }}
        />
      </div>

      <div style={{ fontFamily: BRAND.fonts.mono, color: BRAND.colors.acid, fontSize: '72px', fontWeight: 'bold', marginTop: '35px' }}>
        {progress.toFixed(1)}% <span style={{ fontSize: '24px', color: BRAND.colors.mist }}>EXECUTADO</span>
      </div>
    </div>
  );
};

const FinanceiroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const value = interpolate(frame, [15, 110], [0, 3840650], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(frame, [0, 20], [0, 1], {
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
        opacity,
        position: 'relative',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <HeaderWatermark label="FLUXO FINANCEIRO & EVM" />
      <h2 style={{ fontFamily: BRAND.fonts.display, color: BRAND.colors.offwhite, fontSize: '64px', marginBottom: '20px' }}>
        CUSTO REAL vs. ORÇADO
      </h2>
      <div style={{ fontFamily: BRAND.fonts.mono, color: BRAND.colors.silver, fontSize: '20px', marginBottom: '35px' }}>
        ECONOMIA PROJETADA: <span style={{ color: BRAND.colors.acid }}>+R$ 412.500,00</span>
      </div>

      <div
        style={{
          fontFamily: BRAND.fonts.mono,
          color: BRAND.colors.acid,
          fontSize: '92px',
          fontWeight: 'bold',
          letterSpacing: '-0.02em',
          textShadow: '0 0 40px rgba(198, 255, 0, 0.4)',
        }}
      >
        R$ {Math.floor(value).toLocaleString('pt-BR')}
      </div>
      <div style={{ fontFamily: BRAND.fonts.mono, color: BRAND.colors.mist, fontSize: '18px', marginTop: '15px' }}>
        CONCILIAÇÃO BANCÁRIA PIX / BOLETOS ATIVA
      </div>
    </div>
  );
};

const ObrasScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const obras = [
    { code: 'OBR-001', name: 'RESIDENCIAL SKYLINE', budget: 'R$ 4.2M', status: 'NO PRAZO' },
    { code: 'OBR-002', name: 'PARQUE DAS NAÇÕES', budget: 'R$ 8.9M', status: 'ADIANTADA' },
    { code: 'OBR-003', name: 'CENTRO CORPORATIVO', budget: 'R$ 15.4M', status: 'CRÍTICA' },
  ];

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
        opacity,
        position: 'relative',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <HeaderWatermark label="PORTFÓLIO DE PROJETOS" />
      <h2 style={{ fontFamily: BRAND.fonts.display, color: BRAND.colors.offwhite, fontSize: '64px', marginBottom: '45px' }}>
        MULTI-OBRAS EM TEMPO REAL
      </h2>

      <div style={{ display: 'flex', gap: '30px' }}>
        {obras.map((obra, i) => {
          const cardProgress = interpolate(frame, [20 + i * 20, 55 + i * 20], [0, 1], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const cardY = interpolate(cardProgress, [0, 1], [40, 0]);

          return (
            <div
              key={obra.code}
              style={{
                width: '340px',
                backgroundColor: BRAND.colors.deep,
                border: `1px solid ${BRAND.colors.shadow}`,
                borderTop: `4px solid ${i === 1 ? BRAND.colors.acid : BRAND.colors.purpleLight}`,
                borderRadius: '4px',
                translate: `0px ${cardY}px`,
                opacity: cardProgress,
                padding: '35px 30px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <span style={{ fontFamily: BRAND.fonts.mono, color: BRAND.colors.mist, fontSize: '13px' }}>{obra.code}</span>
                <span
                  style={{
                    fontFamily: BRAND.fonts.mono,
                    fontSize: '11px',
                    color: BRAND.colors.acid,
                    backgroundColor: 'rgba(198, 255, 0, 0.1)',
                    padding: '3px 8px',
                    borderRadius: '2px',
                  }}
                >
                  {obra.status}
                </span>
              </div>
              <div style={{ fontFamily: BRAND.fonts.display, color: BRAND.colors.offwhite, fontSize: '24px', marginBottom: '25px', lineHeight: '1.2' }}>
                {obra.name}
              </div>
              <div style={{ borderTop: `1px solid ${BRAND.colors.shadow}`, paddingTop: '15px' }}>
                <span style={{ fontFamily: BRAND.fonts.mono, color: BRAND.colors.silver, fontSize: '16px' }}>ORÇAMENTO: {obra.budget}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SinapiScene: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const sinapiItems = [
    { code: '98504', desc: 'CONCRETO USINADO BOMBEÁVEL FCK 30 MPA', price: 'R$ 485,20 / M³' },
    { code: '92762', desc: 'ARMAÇÃO DE PILAR OU VIGA DE ESTRUTURA', price: 'R$ 14,80 / KG' },
    { code: '88316', desc: 'SERVENTE COM ENCARGOS COMPLEMENTARES', price: 'R$ 22,40 / H' },
    { code: '88309', desc: 'PEDREIRO COM ENCARGOS COMPLEMENTARES', price: 'R$ 28,90 / H' },
  ];

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
        opacity,
        position: 'relative',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <HeaderWatermark label="TABELAS SINAPI & BDI" />
      <h2 style={{ fontFamily: BRAND.fonts.display, color: BRAND.colors.offwhite, fontSize: '64px', marginBottom: '35px' }}>
        BASE OFICIAL SINAPI INTEGRADA
      </h2>

      <div
        style={{
          width: '950px',
          backgroundColor: BRAND.colors.deep,
          border: `1px solid ${BRAND.colors.smoke}`,
          borderRadius: '4px',
          padding: '30px 40px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: BRAND.fonts.mono,
            color: BRAND.colors.mist,
            fontSize: '14px',
            borderBottom: `1px solid ${BRAND.colors.shadow}`,
            paddingBottom: '14px',
            marginBottom: '20px',
            letterSpacing: '0.1em',
          }}
        >
          <span style={{ width: '120px' }}>CÓDIGO</span>
          <span style={{ flex: 1 }}>COMPOSIÇÃO ANALÍTICA</span>
          <span style={{ width: '180px', textAlign: 'right' }}>VALOR UNITÁRIO</span>
        </div>

        {sinapiItems.map((item, i) => {
          const rowProgress = interpolate(frame, [25 + i * 18, 55 + i * 18], [0, 1], {
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const rowY = interpolate(rowProgress, [0, 1], [15, 0]);

          return (
            <div
              key={item.code}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontFamily: BRAND.fonts.mono,
                fontSize: '18px',
                opacity: rowProgress,
                translate: `0px ${rowY}px`,
                marginBottom: '16px',
                padding: '8px 0',
                borderBottom: i < sinapiItems.length - 1 ? `1px solid ${BRAND.colors.shadow}` : 'none',
              }}
            >
              <span style={{ width: '120px', color: BRAND.colors.acid, fontWeight: 'bold' }}>{item.code}</span>
              <span style={{ flex: 1, color: BRAND.colors.offwhite }}>{item.desc}</span>
              <span style={{ width: '180px', textAlign: 'right', color: BRAND.colors.silver, fontWeight: 'bold' }}>{item.price}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const FeatureDemo: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: BRAND.colors.void }}>
      <Sequence from={0} durationInFrames={150}>
        <MedicoesScene />
      </Sequence>
      <Sequence from={150} durationInFrames={150}>
        <FinanceiroScene />
      </Sequence>
      <Sequence from={300} durationInFrames={150}>
        <ObrasScene />
      </Sequence>
      <Sequence from={450} durationInFrames={150}>
        <SinapiScene />
      </Sequence>
    </div>
  );
};

