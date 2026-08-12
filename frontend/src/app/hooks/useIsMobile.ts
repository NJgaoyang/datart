import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

/** 通过 userAgent 判断是否为手机/平板设备 */
function isTouchDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS/i.test(navigator.userAgent);
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    // 手机设备始终视为移动端，横屏也不切换
    if (isTouchDevice()) return true;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    // 手机设备始终移动端，不随 resize 变化
    if (isTouchDevice()) {
      setIsMobile(true);
      return;
    }
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
