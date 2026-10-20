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

export const Viz = createGlobalStyle`
  /* 手机预览与实际手机共用同一套表单伸缩规则，不能依赖浏览器视口宽度。 */
  .datart-mobile-board .control-form .ant-form-item-label {
    flex: 0 0 auto !important;
    max-width: none !important;
  }

  .datart-mobile-board .control-form .ant-form-item-control {
    flex: 1 1 0 !important;
    min-width: 0;
  }

  /* 覆盖antd 默认样式 */
  @media (max-width: 575px) {
    .datart-viz .ant-form .ant-form-item .ant-form-item-label,
    .datart-viz .ant-form .ant-form-item .ant-form-item-control {
      flex: 1;
    }
  }

  /*
   * Calendar/select overlays are mounted in document.body (or the fullscreen
   * root). They are NOT descendants of .datart-mobile-board, so styling them
   * under the board container never worked. Scope with a popup class that
   * only mobile BoardContext widgets attach; desktop widgets are unchanged.
   */
  .ant-picker-dropdown.datart-mobile-date-popup {
    max-width: calc(100vw - 12px);
    z-index: 1050;
  }

  .ant-picker-dropdown.datart-mobile-date-popup .ant-picker-panel-container {
    max-width: min(320px, calc(100vw - 12px));
    max-height: min(68vh, 560px);
    max-height: min(68dvh, 560px);
    overflow-x: auto;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* Two month panels normally occupy about 560px side by side. On every
   * mobile device and in the desktop editor's mobile preview, use one
   * scrollable column instead. No per-resolution saved layout is added. */
  .ant-picker-dropdown.datart-mobile-date-popup .ant-picker-panels {
    flex-direction: column;
    max-width: 100%;
  }

  .ant-picker-dropdown.datart-mobile-date-popup .ant-picker-panel {
    min-width: 0;
    max-width: 100%;
  }

  .ant-picker-dropdown.datart-mobile-date-popup .ant-picker-panel + .ant-picker-panel {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }

  .ant-picker-dropdown.datart-mobile-date-popup .ant-picker-footer {
    position: sticky;
    bottom: 0;
    background: #fff;
    z-index: 1;
  }

  .ant-select-dropdown.datart-mobile-filter-popup {
    box-sizing: border-box;
    min-width: min(240px, calc(100vw - 12px)) !important;
    max-width: min(320px, calc(100vw - 12px));
    max-height: min(60vh, 440px);
    max-height: min(60dvh, 440px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .ant-select-dropdown.datart-mobile-filter-popup .ant-select-item-option-content,
  .ant-select-dropdown.datart-mobile-filter-popup .datart-filter-tree-label {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ant-select-dropdown.datart-mobile-filter-popup .ant-select-tree-node-content-wrapper {
    min-width: 0;
    overflow: hidden;
  }
`;