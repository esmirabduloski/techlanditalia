import { useEffect, useMemo, useRef, useState } from 'react';
import { Headset, RefreshCw, Send, MessageCircle, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type Conversation = {
  id: string;
  session_id: string;
  started_at: string;
  last_message_at: string | null;
  operator_requested_at: string | null;
  operator_joined_at: string | null;
};

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

export default function AdminLiveChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  const loadConversations = async () => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, session_id, started_at, last_message_at, operator_requested_at, operator_joined_at')
      .order('last_message_at', { ascending: false })
      .limit(100);
    if (error) {
      toast.error('Impossibile caricare le chat: ' + error.message);
    } else {
      setConversations((data ?? []) as Conversation[]);
    }
    setLoading(false);
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error('Impossibile caricare i messaggi: ' + error.message);
      return;
    }
    setMessages((data ?? []) as ChatMessage[]);
  };

  useEffect(() => {
    loadConversations();
    const id = setInterval(loadConversations, 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    loadMessages(activeId);
    const id = setInterval(() => loadMessages(activeId), 6000);
    return () => clearInterval(id);
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinChat = async () => {
    if (!active) return;
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('chat_conversations')
      .update({ operator_joined_at: new Date().toISOString(), operator_id: userData.user?.id ?? null })
      .eq('id', active.id);
    if (error) {
      toast.error('Non sono riuscito ad entrare in chat: ' + error.message);
      return;
    }
    toast.success('Sei in chat: da ora risponde solo tu, l\'assistente AI resta in pausa');
    loadConversations();
  };

  const sendReply = async () => {
    if (!active || !reply.trim()) return;
    setSending(true);
    if (!active.operator_joined_at) await joinChat();
    const { error } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: active.id, role: 'operator', content: reply.trim() });
    setSending(false);
    if (error) {
      toast.error('Messaggio non inviato: ' + error.message);
      return;
    }
    setReply('');
    loadMessages(active.id);
  };

  const waiting = conversations.filter((c) => c.operator_requested_at && !c.operator_joined_at);

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Headset className="w-6 h-6 text-primary" /> Chat dal vivo
            </h1>
            <p className="text-sm text-muted-foreground">
              {conversations.length} conversazioni · {waiting.length} in attesa di un operatore
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadConversations} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Aggiorna
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Conversazioni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
              {conversations.length === 0 && (
                <p className="text-sm text-muted-foreground">Nessuna chat registrata.</p>
              )}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                    c.id === activeId ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">Visitatore {c.session_id.slice(-6)}</span>
                    {c.operator_requested_at && !c.operator_joined_at && (
                      <Badge variant="destructive" className="text-xs">Operatore</Badge>
                    )}
                    {c.operator_joined_at && (
                      <Badge variant="secondary" className="text-xs">In corso</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ultimo messaggio: {fmt(c.last_message_at ?? c.started_at)}
                  </p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader className="pb-3 flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                {active ? `Visitatore ${active.session_id.slice(-6)}` : 'Seleziona una conversazione'}
              </CardTitle>
              {active && !active.operator_joined_at && (
                <Button size="sm" onClick={joinChat}>
                  <LogIn className="w-4 h-4 mr-2" /> Entra in chat
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[55vh] min-h-[240px] space-y-3 overflow-y-auto rounded-lg border p-3">
                {!active && <p className="text-sm text-muted-foreground">Scegli una chat a sinistra per vedere lo storico delle domande.</p>}
                {active && messages.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nessun messaggio in questa conversazione.</p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        m.role === 'user'
                          ? 'bg-muted'
                          : m.role === 'operator'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-accent text-accent-foreground'
                      }`}
                    >
                      <span className="mb-1 block text-xs opacity-70">
                        {m.role === 'user' ? 'Visitatore' : m.role === 'operator' ? 'Operatore' : 'Assistente AI'} ·{' '}
                        {fmt(m.created_at)}
                      </span>
                      <span className="whitespace-pre-wrap">{m.content}</span>
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>

              {active && (
                <div className="space-y-2">
                  <Textarea
                    value={reply}
                    rows={3}
                    maxLength={2000}
                    placeholder="Scrivi la tua risposta al visitatore…"
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                    <Send className="w-4 h-4 mr-2" /> {sending ? 'Invio…' : 'Invia risposta'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
