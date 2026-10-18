/** Semantic dashboard tokens, never persisted layout coordinates. */
export const DASHBOARD_DESIGN_TOKENS = Object.freeze({
  spacing: Object.freeze({ none: 0, grid: 4, card: 6, page: 8, group: 12 }),
  radius: Object.freeze({ metric: 10, card: 12 }),
  typography: Object.freeze({ label: 11, caption: 12, body: 14, sectionTitle: 15, metric: 18 }),
  lineHeight: Object.freeze({ label: 16, sectionTitle: 22, metric: 24 }),
  color: Object.freeze({
    light: Object.freeze({
      page: '#f5f6f8', card: '#fff', text: '#1f2329',
      secondaryText: '#8f959e', border: '#edf0f3',
      subtleBorder: 'rgba(0, 0, 0, 0.04)',
      shadow: '0 1px 2px rgba(0, 0, 0, 0.02), 0 4px 12px rgba(0, 0, 0, 0.03)',
    }),
    dark: Object.freeze({
      page: '#16191f', card: '#23272f', text: '#f1f3f6',
      secondaryText: '#a3acba', border: '#414956',
      subtleBorder: 'rgba(255, 255, 255, 0.10)',
      shadow: '0 1px 2px rgba(0, 0, 0, 0.20), 0 4px 12px rgba(0, 0, 0, 0.24)',
    }),
  }),
} as const);

export const getDashboardDesignPalette = (mode: 'light' | 'dark' = 'light') =>
  DASHBOARD_DESIGN_TOKENS.color[mode];