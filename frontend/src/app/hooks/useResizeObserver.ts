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

import { useLayoutEffect, useState } from 'react';

export default function useResizeObserver<
  T extends HTMLElement = HTMLDivElement,
>({ debounceMs = 0 }: { debounceMs?: number } = {}) {
  const [element, ref] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!element) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    const measure = () => {
      if (disposed) return;
      const rect = element.getBoundingClientRect();
      const width = element.clientWidth || rect.width;
      const height = element.clientHeight || rect.height;
      setSize(previous =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(measure, debounceMs);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener('resize', schedule);
    return () => {
      disposed = true;
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [element, debounceMs]);

  return { ref, ...size };
}
