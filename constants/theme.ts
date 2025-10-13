// constants/theme.ts
export const theme = {
  colors: {
    bg: '#f7f7f7',
    text: '#111111',
    accent: '#FFD000',
    muted: '#666666',
    card: '#ffffff',
    border: '#e5e5e5',
    danger: '#c0392b',
  },
  spacing: (n: number) => n * 8, // theme.spacing(2) === 16
  radius: { sm: 8, md: 12, lg: 16, xl: 24 },
};
