import React from 'react';

export interface FrameContextValue {
  document?: Document;
  window?: Window;
}

// The frame may be imported during server rendering, where browser globals
// are not available.
const initialContext: FrameContextValue = {
  document: typeof document === 'undefined' ? undefined : document,
  window: typeof window === 'undefined' ? undefined : window,
};

export const FrameContext = React.createContext<FrameContextValue>(initialContext);

export const useFrame = () => React.useContext(FrameContext);

export const {
  Provider: FrameContextProvider,
  Consumer: FrameContextConsumer,
} = FrameContext;
