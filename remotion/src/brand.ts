export const BRAND = {
  colors: {
    acid: '#C6FF00',
    acidHover: '#D4FF33',
    void: '#0A0A0A',
    ink: '#0D0D0D',
    deep: '#1A1A1A',
    shadow: '#282828',
    stone: '#2B2B2B',
    smoke: '#3D3D3D',
    mist: '#8E8E8E',
    silver: '#E8E8DC',
    offwhite: '#F0F0E8',
    purple: '#7F49B8',
    purpleLight: '#9B6FD4',
  },
  fonts: {
    display: `'Impact', 'Arial Black', sans-serif`,
    body: `'Arial', 'Helvetica Neue', sans-serif`,
    mono: `'Courier New', monospace`,
  },
  ease: {
    sharp: [0.4, 0, 0.6, 1] as const,
    enter: [0, 0, 0.2, 1] as const,
  },
  name: 'FinGo',
  tagline: 'OBRAS EM FLUXO',
} as const;
