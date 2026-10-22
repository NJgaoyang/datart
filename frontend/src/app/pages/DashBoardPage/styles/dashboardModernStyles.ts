/**
 * Lightweight, borderless BI presentation for read-only auto dashboards.
 *
 * This is intentionally visual-only. Grid coordinates, widget data, query
 * handlers, tab order, navigation structure and editor layout stay intact.
 * All selectors are scoped to .dashboard-modern-auto in the Board wrapper.
 */
import { css } from 'styled-components';

export const dashboardModernStyles = css`
  --bi-primary: #176bfa;
  --bi-primary-hover: #095ce8;
  --bi-page: #fff;
  --bi-surface: #fff;
  --bi-ink: #202b3d;
  --bi-muted: #697588;
  --bi-line: #e9edf2;
  --bi-radius: 8px;

  min-width: 0;
  color: var(--bi-ink);
  background-color: var(--bi-page);

  .board-provider {
    background-color: var(--bi-page);
  }

  /* A restrained page heading, not a large empty title card.
     The top report directory (日报/月报) is outside this scoped selector. */
  .dashboard-modern-title {
    box-sizing: border-box;
    min-height: 58px;
    margin: 0 12px 4px;
    padding: 8px 10px;
    background: #fff;
    border: 0;
    border-bottom: 1px solid #edf0f4;
    border-radius: 0;
    box-shadow: none;
  }

  .dashboard-modern-title h1 {
    min-width: 0;
    font-size: 21px;
    line-height: 30px;
    font-weight: 600;
    color: var(--bi-ink);
  }

  .dashboard-modern-title .ant-btn {
    min-height: 34px;
    border: 1px solid #e1e6ef;
    border-radius: 7px;
    background: #fff;
    color: #39475a;
    box-shadow: none;
  }

  .dashboard-modern-title .ant-btn:hover {
    border-color: #bacff0;
    color: var(--bi-primary);
  }

  /* Keep RGL canvas dimensions unchanged. Eliminate blue page fills. */
  .dashboard-modern-canvas {
    background-color: #fff !important;
    background-image: none !important;
  }

  .dashboard-modern-canvas .grid-wrap {
    scrollbar-width: thin;
    scrollbar-color: #c7d5ec transparent;
  }

  /* One continuous report canvas; no second layer of widget cards. */
  .dashboard-modern-card {
    box-sizing: border-box;
    min-width: 0;
    border: 0 !important;
    border-radius: 0 !important;
    background-color: #fff !important;
    box-shadow: none !important;
  }

  .dashboard-modern-card:hover {
    border: 0 !important;
    box-shadow: none !important;
  }

  .dashboard-modern-card .widget-name {
    color: var(--bi-ink) !important;
    font-weight: 600 !important;
  }

  /* Refine widget-owned report tabs, not the outer 日报/月报 navigation. */
  .dashboard-modern-tabs-card .ant-tabs-nav {
    margin-bottom: 4px;
    border-bottom-color: #edf0f4;
  }

  .dashboard-modern-tabs-card .ant-tabs-tab-btn {
    color: var(--bi-muted);
    transition: color 0.18s ease;
  }

  .dashboard-modern-tabs-card .ant-tabs-tab-active .ant-tabs-tab-btn {
    color: var(--bi-primary);
    font-weight: 650;
  }

  .dashboard-modern-tabs-card .ant-tabs-ink-bar {
    height: 3px;
    border-radius: 3px 3px 0 0;
    background: var(--bi-primary);
  }

  /* Flat tables, with quiet header emphasis and row dividers. */
  .dashboard-modern-card .ant-table-container {
    border: 0;
    border-radius: 0;
  }

  .dashboard-modern-card .ant-table-thead > tr > th {
    color: #425167;
    background: #f7f9fc !important;
    border-bottom-color: #e9edf3 !important;
    font-weight: 600;
  }

  .dashboard-modern-card .ant-table-tbody > tr:hover > td {
    background: #f6f9ff !important;
  }

  /* Each filter is an inline label and input, not a nested card.
     Preserve menu/status affordances at the trailing edge of each widget. */
  .controller-widget {
    box-sizing: border-box;
    flex: 0 1 auto !important;
    width: 100%;
    height: 100% !important;
    max-height: 46px;
    min-height: 0;
    margin-block: auto;
    padding: 1px 4px !important;
    background: transparent !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
  }

  .controller-widget:hover,
  .controller-widget:focus-within {
    background: transparent !important;
    border: 0 !important;
    box-shadow: none !important;
  }

  .controller-widget .ant-form-item-row {
    gap: 6px;
  }

  .controller-widget .ant-form-item-label {
    flex: 0 0 auto;
    width: fit-content;
    max-width: 40%;
  }

  /* Keep the action menu accessible, but do not reserve extra card gutter. */
  .controller-widget .widget-action-toolbar {
    margin-left: 0;
  }

  @media (pointer: fine) {
    .controller-widget .widget-tool-dropdown {
      width: 28px;
      min-width: 28px;
    }
  }

  /* Only the native inputs retain a thin operation boundary. */
  .controller-widget .ant-select-selector,
  .controller-widget .ant-picker {
    border-color: #dde3eb !important;
    border-radius: 7px !important;
    background: #fff !important;
    box-shadow: none !important;
  }

  .controller-widget .ant-select:hover .ant-select-selector,
  .controller-widget .ant-picker:hover {
    border-color: #aebfd5 !important;
  }

  .controller-widget .ant-select-focused .ant-select-selector,
  .controller-widget .ant-picker:focus-within {
    border-color: var(--bi-primary) !important;
    box-shadow: 0 0 0 2px rgba(23, 107, 250, 0.10) !important;
  }

  /* Buttons align with the inputs instead of expanding into bulky blocks. */
  .dashboard-query-action,
  .dashboard-reset-action {
    padding: 0 !important;
  }

  .dashboard-modern-query-button,
  .dashboard-modern-reset-button {
    box-sizing: border-box;
    flex: 0 0 auto !important;
    align-self: center;
    height: 40px !important;
    min-height: 40px !important;
    max-height: 40px;
    border-radius: 7px;
    box-shadow: none !important;
  }

  .dashboard-modern-query-button {
    color: #fff;
    background: #176bfa !important;
    box-shadow: none !important;
  }

  .dashboard-modern-query-button span {
    color: #fff !important;
  }

  .dashboard-modern-query-button:hover {
    background: #095ce8 !important;
    box-shadow: none !important;
  }

  .dashboard-modern-reset-button {
    border-color: #dfe5ed !important;
    background: #fff !important;
    color: var(--bi-ink);
    box-shadow: none !important;
  }

  .dashboard-modern-reset-button:hover {
    border-color: #b6c7dd !important;
    background: #fafcff !important;
  }

  @media (max-width: 767px) {
    .dashboard-modern-title {
      min-height: 52px;
      margin: 0 8px 4px;
      padding: 6px 8px;
      border-radius: 0;
    }

    .dashboard-modern-title h1 {
      font-size: 19px;
      line-height: 28px;
    }

    .controller-widget {
      max-height: 42px;
      padding: 0 2px !important;
    }

    .dashboard-modern-query-button,
    .dashboard-modern-reset-button {
      height: min(40px, 100%) !important;
      min-height: 32px !important;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dashboard-modern-card,
    .controller-widget,
    .dashboard-modern-query-button,
    .dashboard-modern-reset-button {
      transition: none !important;
    }
  }
`;
