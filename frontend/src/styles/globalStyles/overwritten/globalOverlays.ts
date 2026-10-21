/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createGlobalStyle } from 'styled-components';
import {
  LEVEL_1000,
  SPACE_SM,
  SPACE_TIMES,
  SPACE_XS,
} from 'styles/StyleConstants';

export const GlobalOverlays = createGlobalStyle`
  /* app/components/Popup */
  .datart-popup {
    z-index: ${LEVEL_1000 - 1};

    &.on-modal {
      z-index: ${LEVEL_1000 + 30};
    }

    .ant-popover-arrow {
      display: none;
    }
    .ant-popover-inner-content {
      padding: 0;
    }
    .ant-dropdown-menu {
      box-shadow: none;
    }
    &.ant-popover-placement-bottom,
    &.ant-popover-placement-bottomLeft,
    &.ant-popover-placement-bottomRight {
      padding-top: 0;
    }
  }
  

  /* schema table header action dropdown menu */
  .datart-schema-table-header-menu {
    min-width: ${SPACE_TIMES(40)};

    .ant-dropdown-menu-submenu-selected {
      .ant-dropdown-menu-submenu-title {
        color: ${p => p.theme.textColor};
      }
    }
  }

  /* config panel */
  .datart-config-panel {
    &.ant-collapse >
    .ant-collapse-item >
    .ant-collapse-header {
      padding: ${SPACE_XS} 0;
      color: ${p => p.theme.textColor};

      .ant-collapse-arrow {
        margin-right: ${SPACE_XS};
      }
    }

    .ant-collapse-content >
    .ant-collapse-content-box {
      padding: ${SPACE_XS} 0 ${SPACE_SM} !important;
    }
  }

  /* data config section dropdown */
  .datart-data-section-dropdown {
    z-index: ${LEVEL_1000 - 1};
  }

  /* Dashboard filters render popups in the document/fullscreen root.
     Keep their visual language aligned with the in-widget controls without
     changing editor menus or non-dashboard dropdowns. */
  .ant-select-dropdown.datart-dashboard-filter-popup {
    padding: 6px;
    border: 1px solid ${p => p.theme.borderColorSplit};
    border-radius: 12px;
    background-color: ${p => p.theme.componentBackground};
    box-shadow:
      0 4px 10px rgba(15, 23, 42, 0.06),
      0 14px 32px rgba(15, 23, 42, 0.10);
  }

  .datart-dashboard-filter-popup .ant-select-item-option {
    min-height: 34px;
    border-radius: 7px;
    transition: background-color 140ms ease;
  }

  .datart-dashboard-filter-popup .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
    background: rgba(22, 119, 255, 0.065);
  }

  .datart-dashboard-filter-popup .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
    background: rgba(22, 119, 255, 0.10);
    color: ${p => p.theme.textColor};
    font-weight: 500;
  }

  .datart-dashboard-filter-popup .ant-select-tree-node-content-wrapper:hover {
    border-radius: 6px;
    background: rgba(22, 119, 255, 0.065);
  }

  .ant-picker-dropdown.datart-dashboard-date-popup .ant-picker-panel-container {
    border: 1px solid ${p => p.theme.borderColorSplit};
    border-radius: 12px;
    background: ${p => p.theme.componentBackground};
    box-shadow:
      0 4px 10px rgba(15, 23, 42, 0.06),
      0 14px 32px rgba(15, 23, 42, 0.10);
  }

  /* The mobile calendar footer is sticky; match the active theme rather
     than forcing the light theme's white background. */
  .ant-picker-dropdown.datart-dashboard-date-popup.datart-mobile-date-popup .ant-picker-footer {
    background: ${p => p.theme.componentBackground};
  }

  @media (prefers-reduced-motion: reduce) {
    .datart-dashboard-filter-popup .ant-select-item-option {
      transition: none;
    }
  }

  /* color popover */
  .datart-aggregation-colorpopover{
    .ant-popover-arrow{
      display:none;
    }
  }
`;
