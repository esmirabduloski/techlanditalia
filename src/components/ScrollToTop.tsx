import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackGAPageView } from '@/lib/googleAnalytics';
import { isPrivateAreaPath } from '@/lib/privateAreas';
import { captureReferralFromUrl } from '@/lib/referral';

const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Cattura globale del codice referral (?ref=CODICE) su qualsiasi pagina
    captureReferralFromUrl(search);
    // Page view GA4 a ogni cambio route SPA. Le aree private (admin,
    // area riservata, insegnante, login) non vengono tracciate su Analytics;
    // le landing /lp delle campagne sì.
    if (!isPrivateAreaPath(pathname)) {
      trackGAPageView(pathname);
    }
  }, [pathname, search]);

  return null;
};

export default ScrollToTop;
