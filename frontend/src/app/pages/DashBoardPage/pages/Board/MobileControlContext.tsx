/**
 * 移动端控制组件上下文
 *
 * 提供 getPopupContainer 覆盖，用于将 DatePicker / Select 等弹窗挂载到 document.body，
 * 避免在移动端窄容器中被裁剪或模糊。
 * PC 端不提供此上下文，保持原有行为不变。
 */
import React, { createContext, useContext } from 'react';

export interface MobileControlContextValue {
  getPopupContainer?: () => HTMLElement;
}

export const MobileControlContext = createContext<MobileControlContextValue>({});

export function useMobileControl(): MobileControlContextValue {
  return useContext(MobileControlContext);
}
