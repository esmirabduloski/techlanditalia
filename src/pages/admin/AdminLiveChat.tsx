import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  Headset,
  RefreshCw,
  Send,
  MessageCircle,
  LogIn,
  LogOut,
  Zap,
  CheckCircle2,
  Bot,
  Clock,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { QUICK_REPLY_CATEGORIES } from '@/lib/chatQuickReplies';

type Conversation = {
  id: string;
  session_id: string;
  started_at: string;
  last_message_at: string | null;
  operator_requested_at: string | null;
  operator_joined_at: string | null;
  ended_at: string | null;
  metadata: { contact?: string; contact_type?: string } | null;
};

type ChatMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

type ConversationStatus = 'waiting' | 'live' | 'ended' | 'ai';
type ListFilter = 'open' | 'waiting' | 'ended' | 'all';

const CONVERSATION_FIELDS =
  'id, session_id, started_at, last_message_at, operator_requested_at, operator_joined_at, ended_at, metadata';

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

const ago = (iso: string | null) =>
  iso ? formatDistanceToNowStrict(new Date(iso), { locale: it, addSuffix: true }) : '—';

/** Stato di una conversazione: una chat resta "in corso" finché l'operatore non la termina. */
const statusOf = (c: Conversation): ConversationStatus => {
  if (c.ended_at) return 'ended';
  if (c.operator_joined_at) return 'live';
  if (c.operator_requested_at) return 'waiting';
  return 'ai';
};

const STATUS_BADGE: Record<ConversationStatus, { label: string; className: string }> = {
  waiting: { label: 'In attesa', className: 'bg-destructive text-destructive-foreground' },
  live: { label: 'In corso', className: 'bg-emerald-600 text-white' },
  ended: { label: 'Terminata', className: 'bg-muted text-muted-foreground' },
  ai: { label: 'Solo AI', className: 'bg-accent text-accent-foreground' },
};

const FILTERS: { id: ListFilter; label: string }[] = [
  { id: 'open', label: 'Aperte' },
  { id: 'waiting', label: 'In attesa' },
  { id: 'ended', label: 'Terminate' },
  { id: 'all', label: 'Tutte' },
];

export default function AdminLiveChat() {
  const [searchParams, setSearchParams] = useSearchParams();
  // L'id della chat vive nell'URL: così la notifica push (?conversation=…) apre direttamente la chat giusta
  const activeId = searchParams.get('conversation');
  const activeIdRef = useRef<string | null>(activeId);
  activeIdRef.current = activeId;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [filter, setFilter] = useState<ListFilter>('open');
  const [quickCategory, setQuickCategory] = useState(QUICK_REPLY_CATEGORIES[0]?.id ?? '');
  const messagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);
  const activeStatus = active ? statusOf(active) : null;

  const selectConversation = (id: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('conversation', id);
        return next;
      },
      { replace: true }
    );
  };

  const loadConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select(CONVERSATION_FIELDS)
      .order('last_message_at', { ascending: false })
      .limit(100);
    if (error) {
      toast.error('Impossibile caricare le chat: ' + error.message);
      setLoading(false);
      return;
    }
    let list = (data ?? []) as Conversation[];

    // La chat aperta dalla notifica potrebbe essere più vecchia delle ultime 100: la recuperiamo a parte
    const wanted = activeIdRef.current;
    if (wanted && !list.some((c) => c.id === wanted)) {
      const { data: single } = await supabase
        .from('chat_conversations')
        .select(CONVERSATION_FIELDS)
        .eq('id', wanted)
        .maybeSingle();
      if (single) list = [single as Conversation, ...list];
      else toast.error('Conversazione non trovata');
    }
    setConversations(list);
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error('Impossibile caricare i messaggi: ' + error.message);
      return;
    }
    // Evita di rimpiazzare i messaggi se nel frattempo l'operatore ha cambiato chat
    if (activeIdRef.current !== conversationId) return;
    setMessages((data ?? []) as ChatMessage[]);
  }, []);

  useEffect(() => {
    loadConversations();
    const id = setInterval(loadConversations, 15000);
    return () => clearInterval(id);
  }, [loadConversations]);

  useEffect(() => {
    setMessages([]);
    setReply('');
    if (!activeId) return;
    loadMessages(activeId);
    // Su telefono (arrivando dalla notifica) il pannello chat sta sotto l'elenco: lo portiamo in vista
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      chatPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const id = setInterval(() => loadMessages(activeId), 6000);
    return () => clearInterval(id);
  }, [activeId, loadMessages]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
    toast.success("Sei in chat: da ora risponde solo tu, l'assistente AI resta in pausa");
    loadConversations();
  };

  const sendReply = async () => {
    if (!active || !reply.trim() || active.ended_at) return;
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
    textareaRef.current?.focus();
  };

  /** Chiude la chat: il visitatore viene avvisato e torna a parlare con l'assistente AI. */
  const endChat = async () => {
    if (!active) return;
    setEnding(true);
    const { error } = await supabase
      .from('chat_conversations')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', active.id);
    setEnding(false);
    if (error) {
      toast.error('Impossibile terminare la chat: ' + error.message);
      return;
    }
    toast.success("Chat terminata: il visitatore torna a parlare con l'assistente AI");
    loadConversations();
  };

  /** Inserisce una risposta rapida nella casella (senza inviarla) e mette il cursore alla fine. */
  const insertQuickReply = (text: string) => {
    setReply(text);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendReply();
    }
  };

  const counts = useMemo(() => {
    const c = { open: 0, waiting: 0, ended: 0, all: conversations.length };
    for (const conv of conversations) {
      const s = statusOf(conv);
      if (s === 'ended') c.ended++;
      else c.open++;
      if (s === 'waiting') c.waiting++;
    }
    return c;
  }, [conversations]);

  const visibleConversations = useMemo(
    () =>
      conversations.filter((c) => {
        if (c.id === activeId) return true; // la chat aperta resta sempre visibile
        const s = statusOf(c);
        if (filter === 'all') return true;
        if (filter === 'ended') return s === 'ended';
        if (filter === 'waiting') return s === 'waiting';
        return s !== 'ended';
      }),
    [conversations, filter, activeId]
  );

  const currentCategory = QUICK_REPLY_CATEGORIES.find((c) => c.id === quickCategory) ?? QUICK_REPLY_CATEGORIES[0];

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
              {counts.open} aperte · {counts.waiting} in attesa di un operatore · {counts.ended} terminate
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadConversations} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Aggiorna
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <Card className="h-fit">
            <CardHeader className="pb-3 space-y-3">
              <CardTitle className="text-base">Conversazioni</CardTitle>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      filter === f.id
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {f.label} <span className="opacity-70">({counts[f.id]})</span>
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-y-auto">
              {!loading && visibleConversations.length === 0 && (
                <p className="text-sm text-muted-foreground">Nessuna chat in questa vista.</p>
              )}
              {visibleConversations.map((c) => {
                const s = statusOf(c);
                const badge = STATUS_BADGE[s];
                return (
                  <button
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                      c.id === activeId ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                    } ${s === 'ended' ? 'opacity-70' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">Visitatore {c.session_id.slice(-6)}</span>
                      <Badge className={`text-xs shrink-0 ${badge.className}`}>{badge.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {s === 'waiting' && c.operator_requested_at
                        ? `In attesa ${ago(c.operator_requested_at)}`
                        : `Ultimo messaggio ${ago(c.last_message_at ?? c.started_at)}`}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card ref={chatPanelRef} className="flex flex-col scroll-mt-40">
            <CardHeader className="pb-3 flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                <MessageCircle className="w-4 h-4 text-primary" />
                {active ? `Visitatore ${active.session_id.slice(-6)}` : 'Seleziona una conversazione'}
                {active && activeStatus && (
                  <Badge className={`text-xs ${STATUS_BADGE[activeStatus].className}`}>
                    {STATUS_BADGE[activeStatus].label}
                  </Badge>
                )}
              </CardTitle>
              {active && !active.ended_at && (
                <div className="flex items-center gap-2">
                  {!active.operator_joined_at && (
                    <Button size="sm" onClick={joinChat}>
                      <LogIn className="w-4 h-4 mr-2" /> Entra in chat
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10" disabled={ending}>
                        <LogOut className="w-4 h-4 mr-2" /> Termina chat
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Terminare questa chat?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Il visitatore vedrà che l&apos;operatore ha lasciato la conversazione e tornerà a parlare con
                          l&apos;assistente AI. Se non l&apos;hai già fatto, manda prima un messaggio di saluto (trovi le
                          risposte rapide nella categoria &quot;Chiusura&quot;). La chat resterà consultabile tra le terminate.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                        <AlertDialogAction onClick={endChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Termina chat
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {active?.metadata?.contact && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Recapito lasciato dal visitatore:</span>
                  <a
                    href={
                      active.metadata.contact.includes('@')
                        ? `mailto:${active.metadata.contact}`
                        : `tel:${active.metadata.contact.replace(/\s/g, '')}`
                    }
                    className="font-medium text-primary underline"
                  >
                    {active.metadata.contact}
                  </a>
                </div>
              )}
              {active && activeStatus === 'waiting' && (
                <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
                  <Clock className="w-4 h-4 text-destructive shrink-0" />
                  Il visitatore ha chiesto un operatore {ago(active.operator_requested_at)}. Rispondi qui sotto: entrerai in chat
                  automaticamente e l&apos;assistente AI si metterà in pausa.
                </div>
              )}
              {active && activeStatus === 'ai' && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  <Bot className="w-4 h-4 shrink-0" />
                  Al momento risponde l&apos;assistente AI. Puoi comunque intervenire: al primo messaggio entri tu in chat.
                </div>
              )}

              <div
                ref={messagesRef}
                className="max-h-[55vh] min-h-[240px] space-y-3 overflow-y-auto rounded-lg border p-3"
              >
                {!active && (
                  <p className="text-sm text-muted-foreground">Scegli una chat a sinistra per vedere lo storico delle domande.</p>
                )}
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
                {active?.ended_at && (
                  <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Chat terminata dall&apos;operatore il {fmt(active.ended_at)}
                  </p>
                )}
              </div>

              {active && active.ended_at && (
                <p className="text-sm text-muted-foreground">
                  Questa chat è terminata ed è in sola lettura. Se il visitatore scrive di nuovo, comparirà una nuova
                  conversazione nell&apos;elenco.
                </p>
              )}

              {active && !active.ended_at && (
                <div className="space-y-3">
                  {/* Risposte rapide: riempiono la casella, l'invio resta manuale */}
                  <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      <Zap className="w-3.5 h-3.5" /> Risposte rapide — clicca per inserirle nella casella, poi modifica e invia
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_REPLY_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setQuickCategory(cat.id)}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            currentCategory?.id === cat.id
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'bg-background hover:bg-muted'
                          }`}
                        >
                          {cat.emoji} {cat.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {currentCategory?.replies.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          title={r.text}
                          onClick={() => insertQuickReply(r.text)}
                          className="rounded-md border bg-background px-2.5 py-1.5 text-xs text-left transition-colors hover:border-primary hover:bg-primary/5"
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    ref={textareaRef}
                    value={reply}
                    rows={3}
                    maxLength={2000}
                    placeholder="Scrivi la tua risposta al visitatore…"
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      Invio per inviare · Maiusc+Invio per andare a capo · {reply.length}/2000
                    </span>
                    <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                      <Send className="w-4 h-4 mr-2" /> {sending ? 'Invio…' : 'Invia risposta'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
