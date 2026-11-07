// NexaLiving dark theme — brand palette from wireframes/theme.png
// (deep teal + bright emerald), re-mapped onto dark surfaces. Font: Inter (system fallback).
export const colors = {
  bg: '#07100E',
  surface: '#0D1B18',
  card: '#12251F',
  cardAlt: '#173129',
  border: '#1F3A33',
  teal: '#0F6B5B',
  tealDeep: '#0A4A40',
  accent: '#00E676',
  accentSoft: 'rgba(0,230,118,0.14)',
  accentText: '#04150F',
  text: '#EAF6F2',
  textDim: '#8DA8A0',
  textMute: '#5E7A72',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',
  overlay: 'rgba(0,0,0,0.6)',
};

export const radius = { btn: 12, card: 16, chip: 999, input: 12 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const font = {
  display: { fontSize: 32, fontWeight: '700' as const },
  title: { fontSize: 26, fontWeight: '700' as const },
  section: { fontSize: 20, fontWeight: '600' as const },
  cardTitle: { fontSize: 16, fontWeight: '600' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  button: { fontSize: 16, fontWeight: '600' as const },
};
