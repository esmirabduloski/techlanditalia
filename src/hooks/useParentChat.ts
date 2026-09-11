import { useState, useCallback, useRef, useEffect } from 'react';

type Message = {
  role: 'user' | 'assistant' | 'operator';
  content: string;
};

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const CHAT_URL = `${FUNCTIONS_URL}/parent-chat`;
const OPERATOR_URL = `${FUNCTIONS_URL}/chat-operator`;

const AUTH_HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
};

const WELCOME =
  'Ciao! 👋 Sono l\'assistente di TECHLAND. Come posso aiutarti oggi? Posso rispondere a domande sui nostri corsi di coding per bambini e ragazzi.';

// Generate a unique session ID for this chat session
const generateSessionId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

export function useParentChat() {
  const sessionIdRef = useRef(generateSessionId());
  const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: WELCOME }]);
  const [isLoading, setIsLoading] = useState(false);
  const [operatorRequested, setOperatorRequested] = useState(false);
  const [operatorActive, setOperatorActive] = useState(false);
  const lastOperatorMsgRef = useRef<string | null>(null);

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    let assistantContent = '';

    const updateAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && prev.length > newMessages.length) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
        }
        return [...newMessages, { role: 'assistant', content: assistantContent }];
      });
    };

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: AUTH_HEADERS,
        // Il backend accetta solo i ruoli user/assistant
        body: JSON.stringify({
          messages: newMessages
            .filter((m) => m.role !== 'operator')
            .map((m) => ({ role: m.role, content: m.content })),
          sessionId: sessionIdRef.current,
        }),
      });

      if (!resp.ok) throw new Error('Errore nella risposta');

      // Quando un operatore umano è in chat (o è stato appena richiesto)
      // la funzione risponde in JSON invece di uno stream.
      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await resp.json();
        if (data.operatorActive) setOperatorActive(true);
        if (data.operatorRequested) setOperatorRequested(true);
        if (data.message) setMessages([...newMessages, { role: 'assistant', content: data.message }]);
        return;
      }

      if (!resp.body) throw new Error('Errore nella risposta');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) updateAssistant(content);
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...newMessages,
        { role: 'assistant', content: 'Mi dispiace, si è verificato un errore. Riprova più tardi o contattaci direttamente.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  /** Chiede esplicitamente di parlare con un operatore umano. */
  const requestOperator = useCallback(async () => {
    if (operatorRequested) return;
    setOperatorRequested(true);
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    try {
      const resp = await fetch(OPERATOR_URL, {
        method: 'POST',
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          action: 'request',
          sessionId: sessionIdRef.current,
          lastQuestion: lastUser?.content?.slice(0, 500),
        }),
      });
      if (!resp.ok) throw new Error('request failed');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Ho avvisato il nostro team ✅ Un operatore ti risponderà qui in chat il prima possibile. Resta su questa pagina!',
        },
      ]);
    } catch (e) {
      console.error('Operator request error:', e);
      setOperatorRequested(false);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Non riesco a contattare il team in questo momento. Scrivici dalla pagina /contatti e ti risponderemo subito.',
        },
      ]);
    }
  }, [messages, operatorRequested]);

  // Polling dei messaggi dell'operatore: attivo appena esiste una conversazione,
  // così l'operatore può entrare in chat anche senza una richiesta esplicita.
  useEffect(() => {
    if (!operatorRequested && !operatorActive && !conversationStarted) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const resp = await fetch(OPERATOR_URL, {
          method: 'POST',
          headers: AUTH_HEADERS,
          body: JSON.stringify({
            action: 'poll',
            sessionId: sessionIdRef.current,
            since: lastOperatorMsgRef.current ?? undefined,
          }),
        });
        if (!resp.ok || cancelled) return;
        const data = await resp.json();
        if (data.operatorActive) setOperatorActive(true);
        const incoming = (data.messages ?? []) as { content: string; created_at: string }[];
        if (incoming.length > 0) {
          lastOperatorMsgRef.current = incoming[incoming.length - 1].created_at;
          setMessages((prev) => [
            ...prev,
            ...incoming.map((m) => ({ role: 'operator' as const, content: m.content })),
          ]);
        }
      } catch {
        // riprova al giro successivo
      }
    };

    poll();
    const id = setInterval(poll, 6000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [operatorRequested]);

  const clearChat = useCallback(() => {
    // Generate new session ID for new conversation
    sessionIdRef.current = generateSessionId();
    lastOperatorMsgRef.current = null;
    setOperatorRequested(false);
    setOperatorActive(false);
    setMessages([{ role: 'assistant', content: WELCOME }]);
  }, []);

  return { messages, isLoading, sendMessage, clearChat, requestOperator, operatorRequested, operatorActive };
}
