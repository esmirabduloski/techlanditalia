-- Fix chat_conversations: block all writes from client (only edge functions should write)
CREATE POLICY "Block direct inserts on chat_conversations"
ON public.chat_conversations FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Block direct updates on chat_conversations"
ON public.chat_conversations FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "Block direct deletes on chat_conversations"
ON public.chat_conversations FOR DELETE
TO authenticated
USING (false);