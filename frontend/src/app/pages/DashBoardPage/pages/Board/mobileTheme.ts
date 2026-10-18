import { DASHBOARD_DESIGN_TOKENS as T, getDashboardDesignPalette } from '../../styles/dashboardDesignTokens';

const light = getDashboardDesignPalette('light');
// Same existing look. No change to user-selected margins, pRect or mRect.
export const MOBILE_BOARD_THEME = {
  pageBackground: light.page,
  cardBackground: light.card,
  cardRadius: T.radius.card,
  pagePadding: T.spacing.page,
  gridGap: T.spacing.grid,
  cardBorder: light.subtleBorder,
  cardShadow: light.shadow,
  titleColor: light.text,
  secondaryTextColor: light.secondaryText,
  primaryTextColor: light.text,
} as const;