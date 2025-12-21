-- Remove overly permissive INSERT policies on chat tables
-- The edge function uses service_role which bypasses RLS, so these policies are unnecessary
-- and create a security vulnerability allowing direct inserts with the anon key

-- Remove public insert policy on chat_conversations
DROP POLICY IF EXISTS "Allow public insert on chat_conversations" ON public.chat_conversations;

-- Remove public insert policy on chat_messages  
DROP POLICY IF EXISTS "Allow public insert on chat_messages" ON public.chat_messages;