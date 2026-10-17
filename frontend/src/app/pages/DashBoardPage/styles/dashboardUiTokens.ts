/** Shared interaction dimensions across dashboard widgets and edit controls.
 * Widget data coordinates and user-chosen sizes are never stored in pixels.
 */
export const DASHBOARD_UI_TOKENS = Object.freeze({
  actionButtonWidth: 36,
  actionButtonHeight: 32,
  touchActionSize: 44,
  compactToolbarWidth: 850,
  compactFilterWidth: 300,
} as const);
