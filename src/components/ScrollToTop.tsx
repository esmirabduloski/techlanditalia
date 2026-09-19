import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackGAPageView } from '@/lib/googleAnalytics';
import { isNonPrerenderedPath } from '@/lib/prerender';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Page view GA4 a ogni cambio route SPA. Le aree private (admin,
    // area riservata, insegnante) non vengono tracciate su Analytics.
    if (!isNonPrerenderedPath(pathname)) {
      trackGAPageView(pathname);
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
