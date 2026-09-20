import { Img, staticFile } from 'remotion';
import React from 'react';
import { BRAND } from './brand';

export interface CanalThumbnailProps {
  tituloLinha1?: string;
  tituloLinha2?: string;
  destaqueNeon?: string;
  tagSuperior?: string;
  badgeTempo?: string;
  moduloNome?: string;
  iconeModulo?: string;
}

export const CanalThumbnail: React.FC<CanalThumbnailProps> = ({
  tituloLinha1 = 'ORÇAMENTO SINAPI',
  tituloLinha2 = 'BDI CAIXA EM 5 MIN',
  destaqueNeon = 'PASSO A PASSO',
  tagSuperior = 'ENGENHARIA DE CUSTOS & CAIXA',
  badgeTempo = '4 MIN',
  moduloNome = 'Orçamentos & SINAPI',
  iconeModulo = '📐',
}) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: BRAND.colors.void,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px 80px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Grid Técnico de Fundo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(198, 255, 0, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(198, 255, 0, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '90px 90px',
          backgroundPosition: 'center center',
          pointerEvents: 'none',
        }}
      />

      {/* Gradientes e Acentos de Fundo */}
      <div
        style={{
          position: 'absolute',
          top: '-150px',
          right: '-150px',
          width: '700px',
          height: '700px',
          borderRadius: '50%',
          backgroundColor: BRAND.colors.acid,
          filter: 'blur(260px)',
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-120px',
          left: '20%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          backgroundColor: BRAND.colors.purple,
          filter: 'blur(240px)',
          opacity: 0.18,
          pointerEvents: 'none',
        }}
      />

      {/* Topo: Logo Oficial FinGo + Tag da Trilha */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 2,
        }}
      >
        {/* LOGO OFICIAL FINGO — 100% FIEL, NUNCA ALTERADO */}
        <div style={{ width: '260px' }}>
          <Img
            src={staticFile('fingo-logo-full.png')}
            style={{
              width: '100%',
              height: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 16px rgba(0, 0, 0, 0.8))',
            }}
          />
        </div>

        {/* Tag Superior Técnica */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              background: 'rgba(198, 255, 0, 0.12)',
              border: '1px solid rgba(198, 255, 0, 0.4)',
              borderRadius: '4px',
              padding: '8px 18px',
              color: BRAND.colors.acid,
              fontWeight: 900,
              fontSize: '1rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontFamily: BRAND.fonts.mono,
            }}
          >
            {tagSuperior}
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '4px',
              padding: '8px 16px',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.95rem',
              fontFamily: BRAND.fonts.mono,
            }}
          >
            ⏱ {badgeTempo}
          </div>
        </div>
      </div>

      {/* Centro: Título Gigante Brutalist Tech */}
      <div
        style={{
          zIndex: 2,
          maxWidth: '1200px',
          margin: '20px 0',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            backgroundColor: BRAND.colors.acid,
            color: '#0A0A0A',
            padding: '6px 16px',
            fontSize: '1.2rem',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            borderRadius: '4px',
            marginBottom: '16px',
            boxShadow: '0 0 24px rgba(198, 255, 0, 0.5)',
          }}
        >
          ★ {destaqueNeon}
        </div>

        <h1
          style={{
            fontSize: '5.2rem',
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 0.95,
            margin: '0 0 12px',
            textTransform: 'uppercase',
            letterSpacing: '-0.03em',
            textShadow: '0 8px 30px rgba(0, 0, 0, 0.9)',
          }}
        >
          {tituloLinha1}
        </h1>

        <h2
          style={{
            fontSize: '4.4rem',
            fontWeight: 900,
            color: BRAND.colors.acid,
            lineHeight: 1.0,
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '-0.02em',
            textShadow: '0 0 40px rgba(198, 255, 0, 0.4)',
          }}
        >
          {tituloLinha2}
        </h2>
      </div>

      {/* Rodapé: HUD do Módulo e Informações de Engenharia */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '24px',
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: BRAND.colors.silver,
            fontSize: '1.25rem',
            fontWeight: 700,
          }}
        >
          <span style={{ fontSize: '1.6rem' }}>{iconeModulo}</span>
          <span>Módulo Oficial: <strong style={{ color: '#fff' }}>{moduloNome}</strong></span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontFamily: BRAND.fonts.mono,
            fontSize: '1rem',
            color: BRAND.colors.mist,
            letterSpacing: '0.08em',
          }}
        >
          <span>fingo.api.br</span>
          <span>•</span>
          <span style={{ color: BRAND.colors.acid }}>OBRAS EM FLUXO</span>
        </div>
      </div>
    </div>
  );
};
