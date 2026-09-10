-- Colonne per la chat con operatore dal vivo
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS operator_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS operator_id uuid,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_chat_conversations_last_message_at ON public.chat_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_operator_requested ON public.chat_conversations(operator_requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_created ON public.chat_messages(conversation_id, created_at);

-- I messaggi possono ora arrivare anche da un operatore umano
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_role_check;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_role_check CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'operator'::text]));

-- Chi può gestire le chat dal vivo: admin oppure ruolo operatore
CREATE OR REPLACE FUNCTION public.is_chat_support(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'operator'::app_role)
$$;

REVOKE ALL ON FUNCTION public.is_chat_support(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_chat_support(uuid) TO authenticated, service_role;

GRANT SELECT, UPDATE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;

DROP POLICY IF EXISTS "Admins can read all conversations" ON public.chat_conversations;
CREATE POLICY "Support can read conversations"
ON public.chat_conversations FOR SELECT TO authenticated
USING (public.is_chat_support(auth.uid()));

DROP POLICY IF EXISTS "Block direct updates on chat_conversations" ON public.chat_conversations;
CREATE POLICY "Support can update conversations"
ON public.chat_conversations FOR UPDATE TO authenticated
USING (public.is_chat_support(auth.uid()))
WITH CHECK (public.is_chat_support(auth.uid()));

DROP POLICY IF EXISTS "Admins can read all messages" ON public.chat_messages;
CREATE POLICY "Support can read messages"
ON public.chat_messages FOR SELECT TO authenticated
USING (public.is_chat_support(auth.uid()));

CREATE POLICY "Support can send operator messages"
ON public.chat_messages FOR INSERT TO authenticated
WITH CHECK (public.is_chat_support(auth.uid()) AND role = 'operator');