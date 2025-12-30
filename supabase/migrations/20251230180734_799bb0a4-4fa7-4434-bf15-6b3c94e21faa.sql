-- Remove public INSERT policies that allow unauthenticated writes
DROP POLICY IF EXISTS "Allow public insert on chat_conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Allow public insert on chat_messages" ON public.chat_messages;

-- No new INSERT policies needed for regular users since:
-- 1. The parent-chat Edge Function uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
-- 2. Only the Edge Function should be able to insert chat data
-- 3. Admins already have read access via existing policies