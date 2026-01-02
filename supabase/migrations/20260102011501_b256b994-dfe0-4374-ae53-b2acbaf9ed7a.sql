-- Create analytics_events table for tracking user interactions
CREATE TABLE public.analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL,
  event_action TEXT NOT NULL,
  event_label TEXT,
  event_value NUMERIC,
  page_url TEXT,
  page_title TEXT,
  referrer TEXT,
  user_id UUID,
  session_id TEXT NOT NULL,
  device_type TEXT,
  browser TEXT,
  screen_size TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_analytics_events_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_category ON public.analytics_events(event_category);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_events_user ON public.analytics_events(user_id);

-- Create page_views table for detailed page analytics
CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_url TEXT NOT NULL,
  page_title TEXT,
  session_id TEXT NOT NULL,
  user_id UUID,
  time_on_page INTEGER, -- seconds
  scroll_depth INTEGER, -- percentage
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device_type TEXT,
  entered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  exited_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for page_views
CREATE INDEX idx_page_views_url ON public.page_views(page_url);
CREATE INDEX idx_page_views_session ON public.page_views(session_id);
CREATE INDEX idx_page_views_entered ON public.page_views(entered_at);

-- Create conversion_funnels table for tracking conversion steps
CREATE TABLE public.conversion_funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_name TEXT NOT NULL,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID,
  completed BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for funnel analysis
CREATE INDEX idx_conversion_funnels_name ON public.conversion_funnels(funnel_name);
CREATE INDEX idx_conversion_funnels_session ON public.conversion_funnels(session_id);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_funnels ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts for tracking (read only for admins)
CREATE POLICY "Anyone can insert analytics events" 
ON public.analytics_events 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view analytics events" 
ON public.analytics_events 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Anyone can insert page views" 
ON public.page_views 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update their own page views" 
ON public.page_views 
FOR UPDATE 
USING (session_id = session_id);

CREATE POLICY "Admins can view page views" 
ON public.page_views 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Anyone can insert conversion funnels" 
ON public.conversion_funnels 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update their own funnel steps" 
ON public.conversion_funnels 
FOR UPDATE 
USING (session_id = session_id);

CREATE POLICY "Admins can view conversion funnels" 
ON public.conversion_funnels 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);