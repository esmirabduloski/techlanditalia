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
    } catch {
      // Silent fail - analytics should never break UX or pollute console
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
    } catch {
      // Silent fail
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

  // Track route changes (deferred to idle to avoid blocking FCP/TBT)
  useEffect(() => {
    if (currentPageViewId.current) {
      updatePageView();
    }
    pageEnteredAt.current = Date.now();
    maxScrollDepth.current = 0;

    const idle =
      (window as any).requestIdleCallback ||
      ((cb: () => void) => setTimeout(cb, 1500));
    const cancelIdle =
      (window as any).cancelIdleCallback || ((id: number) => clearTimeout(id));
    const handle = idle(() => trackPageView(), { timeout: 3000 });
    return () => cancelIdle(handle);
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

  // Get element selector for tracking
  const getElementSelector = (element: HTMLElement): string => {
    if (element.id) return `#${element.id}`;
    if (element.getAttribute('data-track-cta')) return `[data-track-cta="${element.getAttribute('data-track-cta')}"]`;
    
    const classes = Array.from(element.classList).slice(0, 2).join('.');
    const tag = element.tagName.toLowerCase();
    
    if (classes) return `${tag}.${classes}`;
    return tag;
  };

  // Auto-track CTA clicks via data attributes + position tracking
  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const ctaElement = target.closest('[data-track-cta]');
      
      // Track click position for heatmap
      const clickData = {
        click_x: Math.round(event.clientX),
        click_y: Math.round(event.clientY + window.scrollY),
        viewport_width: window.innerWidth,
        viewport_height: document.documentElement.scrollHeight,
        element_selector: getElementSelector(target),
      };
      
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
            ...clickData,
            metadata: {
              cta_text: ctaText,
              destination,
              source_page: location.pathname,
              timestamp: new Date().toISOString()
            }
          });
        } catch {
          // Silent fail
        }
      } else {
        // Track general clicks on interactive elements for heatmap
        const isInteractive = target.closest('a, button, [role="button"], input, select, textarea, [onclick]');
        if (isInteractive) {
          try {
            await supabase.from('analytics_events').insert({
              event_type: 'element_click',
              event_category: 'engagement',
              event_action: 'click',
              event_label: getElementSelector(target),
              page_url: location.pathname,
              page_title: document.title,
              session_id: sessionId,
              user_id: user?.id || null,
              device_type: getDeviceType(),
              ...clickData,
              metadata: {
                element_text: target.textContent?.trim().substring(0, 50) || '',
                timestamp: new Date().toISOString()
              }
            });
          } catch {
            // Silent fail
          }
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
