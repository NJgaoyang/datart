import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

export type EmbedMode = 'none' | 'weapp';

export const getEmbedMode = (search: string): EmbedMode =>
  new URLSearchParams(search).get('embed') === 'weapp' ? 'weapp' : 'none';

export function useEmbedMode(): EmbedMode {
  const location = useLocation();

  return useMemo(() => getEmbedMode(location.search), [location.search]);
}

export const useIsWeappEmbed = () => useEmbedMode() === 'weapp';
