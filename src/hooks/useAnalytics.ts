import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

// Generate a unique session ID that persists across page loads but not browser sessions
const getSessionId = (): string => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

// Get device info
const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let deviceType = 'desktop';
  if (/Mobi|Android/i.test(ua)) deviceType = 'mobile';
  else if (/Tablet|iPad/i.test(ua)) deviceType = 'tablet';
  
  let browser = 'unknown';
  if (ua.includes('Chrome')) browser = 'chrome';
  else if (ua.includes('Firefox')) browser = 'firefox';
  else if (ua.includes('Safari')) browser = 'safari';
  else if (ua.includes('Edge')) browser = 'edge';
  
  const screenSize = `${window.innerWidth}x${window.innerHeight}`;
  
  return { deviceType, browser, screenSize };
};

// Get UTM parameters from URL
const getUTMParams = () => {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
  };
};

// Event categories
export type EventCategory = 
  | 'conversion'
  | 'engagement'
  | 'navigation'
  | 'cta_click'
  | 'form'
  | 'lesson'
  | 'error';

// Event types
export type EventType =
  | 'page_view'
  | 'cta_click'
  | 'form_start'
  | 'form_submit'
  | 'form_error'
  | 'booking_conversion'
  | 'lesson_start'
  | 'lesson_complete'
  | 'lesson_time'
  | 'scroll_depth'
  | 'outbound_click'
  | 'video_play'
  | 'download';

interface TrackEventParams {
  eventType: EventType;
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  metadata?: Record<string, unknown>;
}

interface AnalyticsHook {
  trackEvent: (params: TrackEventParams) => Promise<void>;
  trackCTAClick: (ctaId: string, ctaText: string, destination?: string) => Promise<void>;
  trackFormStart: (formName: string) => Promise<void>;
  trackFormSubmit: (formName: string, metadata?: Record<string, unknown>) => Promise<void>;
  trackFormError: (formName: string, errorMessage: string) => Promise<void>;
  trackBookingConversion: (bookingData: Record<string, unknown>) => Promise<void>;
  trackLessonStart: (lessonId: string, lessonTitle: string, courseId: string) => Promise<void>;
  trackLessonComplete: (lessonId: string, lessonTitle: string, courseId: string, timeSpent: number) => Promise<void>;
  trackScrollDepth: (depth: number) => void;
  startLessonTimer: () => void;
  getLessonTime: () => number;
  trackFunnelStep: (funnelName: string, stepNumber: number, stepName: string, completed?: boolean) => Promise<void>;
}

export function useAnalytics(): AnalyticsHook {
  const { user } = useAuth();
  const location = useLocation();
  const lessonStartTime = useRef<number>(0);
  const lastScrollDepth = useRef<number>(0);
  const scrollDepthTracked = useRef<Set<number>>(new Set());

  const sessionId = getSessionId();
  const deviceInfo = getDeviceInfo();

  // Core tracking function
  const trackEvent = useCallback(async ({
    eventType,
    category,
    action,
    label,
    value,
    metadata = {}
  }: TrackEventParams): Promise<void> => {
    try {
      await supabase.from('analytics_events').insert({
        event_type: eventType,
        event_category: category,
        event_action: action,
        event_label: label,
        event_value: value,
        page_url: window.location.pathname,
        page_title: document.title,
        referrer: document.referrer || null,
        user_id: user?.id || null,
        session_id: sessionId,
        device_type: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        screen_size: deviceInfo.screenSize,
        metadata: {
          ...metadata,
          ...getUTMParams(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }, [user?.id, sessionId, deviceInfo]);

  // Track CTA clicks
  const trackCTAClick = useCallback(async (
    ctaId: string,
    ctaText: string,
    destination?: string
  ): Promise<void> => {
    await trackEvent({
      eventType: 'cta_click',
      category: 'cta_click',
      action: 'click',
      label: ctaId,
      metadata: {
        cta_text: ctaText,
        destination: destination || 'unknown',
        source_page: window.location.pathname
      }
    });
  }, [trackEvent]);

  // Track form interactions
  const trackFormStart = useCallback(async (formName: string): Promise<void> => {
    await trackEvent({
      eventType: 'form_start',
      category: 'form',
      action: 'start',
      label: formName
    });
  }, [trackEvent]);

  const trackFormSubmit = useCallback(async (
    formName: string,
    metadata?: Record<string, unknown>
  ): Promise<void> => {
    await trackEvent({
      eventType: 'form_submit',
      category: 'form',
      action: 'submit',
      label: formName,
      metadata
    });
  }, [trackEvent]);

  const trackFormError = useCallback(async (
    formName: string,
    errorMessage: string
  ): Promise<void> => {
    await trackEvent({
      eventType: 'form_error',
      category: 'form',
      action: 'error',
      label: formName,
      metadata: { error_message: errorMessage }
    });
  }, [trackEvent]);

  // Track booking conversion
  const trackBookingConversion = useCallback(async (
    bookingData: Record<string, unknown>
  ): Promise<void> => {
    await trackEvent({
      eventType: 'booking_conversion',
      category: 'conversion',
      action: 'booking_complete',
      label: 'trial_booking',
      value: 1,
      metadata: bookingData
    });

    // Also track in conversion funnel
    await trackFunnelStep('booking_funnel', 4, 'booking_complete', true);
  }, [trackEvent]);

  // Track lesson interactions
  const trackLessonStart = useCallback(async (
    lessonId: string,
    lessonTitle: string,
    courseId: string
  ): Promise<void> => {
    lessonStartTime.current = Date.now();
    await trackEvent({
      eventType: 'lesson_start',
      category: 'lesson',
      action: 'start',
      label: lessonId,
      metadata: {
        lesson_title: lessonTitle,
        course_id: courseId
      }
    });
  }, [trackEvent]);

  const trackLessonComplete = useCallback(async (
    lessonId: string,
    lessonTitle: string,
    courseId: string,
    timeSpent: number
  ): Promise<void> => {
    await trackEvent({
      eventType: 'lesson_complete',
      category: 'lesson',
      action: 'complete',
      label: lessonId,
      value: timeSpent,
      metadata: {
        lesson_title: lessonTitle,
        course_id: courseId,
        time_spent_seconds: timeSpent
      }
    });
  }, [trackEvent]);

  // Track scroll depth
  const trackScrollDepth = useCallback((depth: number): void => {
    // Track at 25%, 50%, 75%, 100%
    const milestones = [25, 50, 75, 100];
    const milestone = milestones.find(m => depth >= m && !scrollDepthTracked.current.has(m));
    
    if (milestone && milestone > lastScrollDepth.current) {
      lastScrollDepth.current = milestone;
      scrollDepthTracked.current.add(milestone);
      
      trackEvent({
        eventType: 'scroll_depth',
        category: 'engagement',
        action: 'scroll',
        label: `${milestone}%`,
        value: milestone
      });
    }
  }, [trackEvent]);

  // Lesson timer helpers
  const startLessonTimer = useCallback((): void => {
    lessonStartTime.current = Date.now();
  }, []);

  const getLessonTime = useCallback((): number => {
    if (lessonStartTime.current === 0) return 0;
    return Math.floor((Date.now() - lessonStartTime.current) / 1000);
  }, []);

  // Track conversion funnel steps
  const trackFunnelStep = useCallback(async (
    funnelName: string,
    stepNumber: number,
    stepName: string,
    completed: boolean = false
  ): Promise<void> => {
    try {
      await supabase.from('conversion_funnels').insert({
        funnel_name: funnelName,
        step_number: stepNumber,
        step_name: stepName,
        session_id: sessionId,
        user_id: user?.id || null,
        completed,
        metadata: {
          page_url: window.location.pathname,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Funnel tracking error:', error);
    }
  }, [sessionId, user?.id]);

  // Reset scroll tracking on route change
  useEffect(() => {
    scrollDepthTracked.current = new Set();
    lastScrollDepth.current = 0;
  }, [location.pathname]);

  return {
    trackEvent,
    trackCTAClick,
    trackFormStart,
    trackFormSubmit,
    trackFormError,
    trackBookingConversion,
    trackLessonStart,
    trackLessonComplete,
    trackScrollDepth,
    startLessonTimer,
    getLessonTime,
    trackFunnelStep
  };
}
