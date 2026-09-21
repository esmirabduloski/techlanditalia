import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackGAPageView } from '@/lib/googleAnalytics';
import { isNonPrerenderedPath } from '@/lib/prerender';
import { captureReferralFromUrl } from '@/lib/referral';

const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Cattura globale del codice referral (?ref=CODICE) su qualsiasi pagina
    captureReferralFromUrl(search);
    // Page view GA4 a ogni cambio route SPA. Le aree private (admin,
    // area riservata, insegnante) non vengono tracciate su Analytics.
    if (!isNonPrerenderedPath(pathname)) {
      trackGAPageView(pathname);
    }
  }, [pathname, search]);

  return null;
};

export default ScrollToTop;
