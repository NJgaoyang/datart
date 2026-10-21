/**
 * Modern BI skin for the read-only automatic dashboard surface.
 *
 * Dashboard layout coordinates, widget styles persisted by the user, query
 * actions, navigation tabs and editor behavior remain unchanged. All selectors
 * are nested below .dashboard-modern-auto in the Board view wrapper.
 */
import { css } from 'styled-components';

export const dashboardModernStyles = css`
  --bi-primary: #176bfa;
  --bi-primary-hover: #095ce8;
  --bi-page: #f3f7ff;
  --bi-surface: #fff;
  --bi-ink: #182641;
  --bi-muted: #657794;
  --bi-line: #e4ebf7;
  --bi-shadow: 0 3px 18px rgba(42, 83, 151, 0.055);
  --bi-radius: 14px;

  min-width: 0;
  color: var(--bi-ink);
  background-color: var(--bi-page);

  .board-provider {
    background-color: var(--bi-page);
  }

  /* Visual-only treatment: the dashboard heading and actions keep their DOM. */
  .dashboard-modern-title {
    box-sizing: border-box;
    min-height: 88px;
    margin: 16px 18px 10px;
    padding: 16px 24px;
    background: var(--bi-surface);
    border: 1px solid var(--bi-line);
    border-radius: var(--bi-radius);
    box-shadow: var(--bi-shadow);
  }

  .dashboard-modern-title h1 {
    min-width: 0;
    font-size: 24px;
    line-height: 34px;
    font-weight: 700;
    color: var(--bi-ink);
  }

  .dashboard-modern-title .ant-btn {
    min-height: 36px;
    border: 1px solid #dce5f3;
    border-radius: 9px;
    background: #fff;
    color: var(--bi-ink);
    box-shadow: 0 2px 5px rgba(23, 54, 102, 0.04);
  }

  .dashboard-modern-title .ant-btn:hover {
    border-color: #b6ccf0;
    color: var(--bi-primary);
  }

  /* Do not add layout padding here: RGL measures this exact canvas width. */
  .dashboard-modern-canvas {
    background: linear-gradient(180deg, #f6f9ff 0%, #f1f5fc 100%) !important;
    background-image: none !important;
  }

  .dashboard-modern-canvas .grid-wrap {
    scrollbar-width: thin;
    scrollbar-color: #c7d5ec transparent;
  }

  /* The card outline is inset: existing widget dimensions stay intact. */
  .dashboard-modern-card {
    box-sizing: border-box;
    min-width: 0;
    border: 1px solid var(--bi-line) !important;
    border-radius: var(--bi-radius) !important;
    background-color: var(--bi-surface) !important;
    box-shadow: var(--bi-shadow) !important;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;
  }

  .dashboard-modern-card:hover {
    border-color: #d4e2f9 !important;
    box-shadow: 0 5px 22px rgba(42, 83, 151, 0.085) !important;
  }

  .dashboard-modern-card .widget-name {
    color: var(--bi-ink) !important;
    font-weight: 650 !important;
  }

  /* Refine widget-owned report tabs, not the outer 日报/月报 navigation. */
  .dashboard-modern-tabs-card .ant-tabs-nav {
    border-bottom-color: #e8eef8;
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

  /* Data table styling only inside automatic dashboard report cards. */
  .dashboard-modern-card .ant-table-container {
    border: 1px solid #eaf0fa;
    border-radius: 10px;
  }

  .dashboard-modern-card .ant-table-thead > tr > th {
    color: #334767;
    background: #eff5ff !important;
    border-bottom-color: #e1e9f7 !important;
    font-weight: 600;
  }

  .dashboard-modern-card .ant-table-tbody > tr:hover > td {
    background: #f5f9ff !important;
  }

  /* Filter title remains inline, shrink-wrapped, with no phantom blank area. */
  .controller-widget {
    background: #fff !important;
    border: 1px solid #e2eafa !important;
    border-radius: 11px !important;
    box-shadow: 0 2px 9px rgba(37, 73, 130, 0.055) !important;
  }

  .controller-widget:hover,
  .controller-widget:focus-within {
    border-color: #bad1f9 !important;
    box-shadow: 0 3px 12px rgba(37, 73, 130, 0.09) !important;
  }

  .controller-widget .ant-form-item-row {
    gap: 6px;
  }

  .controller-widget .ant-form-item-label {
    flex: 0 0 auto;
    width: fit-content;
    max-width: 40%;
  }

  .controller-widget .ant-select-selector,
  .controller-widget .ant-picker {
    border-color: #dbe5f5 !important;
    border-radius: 8px !important;
    background: #fff !important;
  }

  .controller-widget .ant-select:hover .ant-select-selector,
  .controller-widget .ant-picker:hover {
    border-color: #9cbef5 !important;
  }

  .controller-widget .ant-select-focused .ant-select-selector,
  .controller-widget .ant-picker:focus-within {
    border-color: var(--bi-primary) !important;
    box-shadow: 0 0 0 3px rgba(23, 107, 250, 0.12) !important;
  }

  .dashboard-query-action,
  .dashboard-reset-action {
    padding: 5px 0 !important;
  }

  .dashboard-modern-query-button {
    color: #fff;
    border-radius: 9px;
    background: linear-gradient(120deg, #3183ff 0%, #176bfa 100%) !important;
    box-shadow: 0 4px 12px rgba(23, 107, 250, 0.20) !important;
  }

  .dashboard-modern-query-button span {
    color: #fff !important;
  }

  .dashboard-modern-query-button:hover {
    background: linear-gradient(120deg, #2477f7 0%, #095ce8 100%) !important;
    box-shadow: 0 5px 14px rgba(23, 107, 250, 0.27) !important;
  }

  .dashboard-modern-reset-button {
    border-radius: 9px;
    border-color: #d6e2f5 !important;
    background: #fff !important;
    color: var(--bi-ink);
    box-shadow: 0 2px 6px rgba(23, 54, 102, 0.055);
  }

  .dashboard-modern-reset-button:hover {
    border-color: #b6cef4 !important;
    background: #f7faff !important;
  }

  @media (max-width: 767px) {
    .dashboard-modern-title {
      min-height: 64px;
      margin: 8px 8px 6px;
      padding: 10px 12px;
      border-radius: 11px;
    }

    .dashboard-modern-title h1 {
      font-size: 19px;
      line-height: 28px;
    }

    .dashboard-modern-card {
      border-radius: 11px !important;
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
