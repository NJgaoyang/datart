/**
 * Datart dashboard element size tracking.
 *
 * Use the browser ResizeObserver directly. react-resize-detector 6.x is from
 * the pre-React-19 era and its legacy ref lifecycle may leave nested dashboard
 * charts with the placeholder 1x1 size after Tabs mount/change.
 *
 * The ref shape intentionally stays compatible with useRenderWidget (which
 * inspects cacheWhRef.current) and existing grid/auto-group callers.
 */
import { useLayoutEffect, useRef, useState } from 'react';

export const useCacheWidthHeight = (arg?: {
  initW?: number;
  initH?: number;
  refreshMode?: 'throttle' | 'debounce';
  refreshRate?: number;
}) => {
  const { initW, initH } = arg || {};
  const cacheWhRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    width: initW ?? 1,
    height: initH ?? 1,
  });

  useLayoutEffect(() => {
    const element = cacheWhRef.current;
    if (!element) return;

    let frame: number | undefined;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      // clientWidth/clientHeight preserve grid coordinates under CSS scale;
      // bounding rect is a fallback for special flex/layout containers.
      const rect = element.getBoundingClientRect();
      const width = element.clientWidth || rect.width;
      const height = element.clientHeight || rect.height;
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      setSize(previous =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };
    const scheduleMeasurement = () => {
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = undefined;
        measure();
      });
    };

    // A pane can be mounted as hidden under AntD Tabs; the observer must
    // measure it AGAIN once it becomes visible instead of caching 1px forever.
    measure();
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(scheduleMeasurement)
        : undefined;
    observer?.observe(element);
    window.addEventListener('resize', scheduleMeasurement);
    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener('resize', scheduleMeasurement);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  return {
    cacheWhRef,
    cacheW: size.width,
    cacheH: size.height,
  };
};
