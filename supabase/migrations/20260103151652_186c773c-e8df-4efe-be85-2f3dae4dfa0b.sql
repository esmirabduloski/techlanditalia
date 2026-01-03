-- Add columns for click position tracking
ALTER TABLE public.analytics_events 
ADD COLUMN IF NOT EXISTS click_x INTEGER,
ADD COLUMN IF NOT EXISTS click_y INTEGER,
ADD COLUMN IF NOT EXISTS viewport_width INTEGER,
ADD COLUMN IF NOT EXISTS viewport_height INTEGER,
ADD COLUMN IF NOT EXISTS element_selector TEXT;