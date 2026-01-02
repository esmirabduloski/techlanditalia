import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

// Session ID management
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

// Get device type
const getDeviceType = (): string => {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'mobile';
  if (/Tablet|iPad/i.test(ua)) return 'tablet';
  return 'desktop';
};

// Get UTM parameters
const getUTMParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
  };
};

interface PageViewData {
  id?: string;
  page_url: string;
  page_title: string;
  session_id: string;
  user_id: string | null;
  referrer: string | null;
  device_type: string;
  entered_at: string;
  time_on_page?: number;
  scroll_depth?: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const currentPageViewId = useRef<string | null>(null);
  const pageEnteredAt = useRef<number>(Date.now());
  const maxScrollDepth = useRef<number>(0);
  const isFirstLoad = useRef<boolean>(true);

  const sessionId = getSessionId();

  // Track page view
  const trackPageView = useCallback(async () => {
    const utmParams = getUTMParams();
    
    const pageViewData: PageViewData = {
      page_url: location.pathname,
      page_title: document.title,
      session_id: sessionId,
      user_id: user?.id || null,
      referrer: isFirstLoad.current ? document.referrer || null : null,
      device_type: getDeviceType(),
      entered_at: new Date().toISOString(),
      ...utmParams
    };

    try {
      const { data, error } = await supabase
        .from('page_views')
        .insert(pageViewData)
        .select('id')
        .single();

      if (!error && data) {
        currentPageViewId.current = data.id;
      }
    } catch (error) {
      console.error('Page view tracking error:', error);
    }

    isFirstLoad.current = false;
  }, [location.pathname, sessionId, user?.id]);

  // Update page view with exit data
  const updatePageView = useCallback(async () => {
    if (!currentPageViewId.current) return;

    const timeOnPage = Math.floor((Date.now() - pageEnteredAt.current) / 1000);

    try {
      await supabase
        .from('page_views')
        .update({
          time_on_page: timeOnPage,
          scroll_depth: maxScrollDepth.current,
          exited_at: new Date().toISOString()
        })
        .eq('id', currentPageViewId.current);
    } catch (error) {
      console.error('Page view update error:', error);
    }
  }, []);

  // Track scroll depth
  const handleScroll = useCallback(() => {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight <= 0) {
      maxScrollDepth.current = 100;
      return;
    }
    
    const scrolled = window.scrollY;
    const depth = Math.min(100, Math.round((scrolled / scrollHeight) * 100));
    
    if (depth > maxScrollDepth.current) {
      maxScrollDepth.current = depth;
    }
  }, []);

  // Track route changes
  useEffect(() => {
    // Update previous page view before tracking new one
    if (currentPageViewId.current) {
      updatePageView();
    }

    // Reset tracking for new page
    pageEnteredAt.current = Date.now();
    maxScrollDepth.current = 0;
    
    // Track new page view
    trackPageView();
  }, [location.pathname, trackPageView, updatePageView]);

  // Set up scroll tracking
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [handleScroll]);

  // Track exit on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentPageViewId.current) {
        // Use sendBeacon for reliable tracking on page exit
        const timeOnPage = Math.floor((Date.now() - pageEnteredAt.current) / 1000);
        
        // Fallback: try to update via supabase (may not complete)
        navigator.sendBeacon?.(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/page_views?id=eq.${currentPageViewId.current}`,
          JSON.stringify({
            time_on_page: timeOnPage,
            scroll_depth: maxScrollDepth.current,
            exited_at: new Date().toISOString()
          })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updatePageView();
    };
  }, [updatePageView]);

  // Auto-track CTA clicks via data attributes
  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const ctaElement = target.closest('[data-track-cta]');
      
      if (ctaElement) {
        const ctaId = ctaElement.getAttribute('data-track-cta');
        const ctaText = ctaElement.textContent?.trim() || '';
        const destination = ctaElement.getAttribute('href') || 
                          ctaElement.closest('a')?.getAttribute('href') || '';

        try {
          await supabase.from('analytics_events').insert({
            event_type: 'cta_click',
            event_category: 'cta_click',
            event_action: 'click',
            event_label: ctaId,
            page_url: location.pathname,
            page_title: document.title,
            session_id: sessionId,
            user_id: user?.id || null,
            device_type: getDeviceType(),
            metadata: {
              cta_text: ctaText,
              destination,
              source_page: location.pathname,
              timestamp: new Date().toISOString()
            }
          });
        } catch (error) {
          console.error('CTA tracking error:', error);
        }
      }
    };

    document.addEventListener('click', handleClick);
    
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [location.pathname, sessionId, user?.id]);

  return <>{children}</>;
}
