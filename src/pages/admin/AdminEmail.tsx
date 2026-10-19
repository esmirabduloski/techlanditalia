import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Head } from 'vite-react-ssg';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, Eye, Library,
  Mail, MailCheck, RefreshCw, Search, Send, ShieldCheck, XCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { emailLogClient } from '@/lib/emailLogClient';
import {
  AUDIENCE_LABELS, CATEGORY_LABELS, CHANNEL_LABELS, PAGE_SIZE, SENT_PERIODS, STATUS_LABELS, UPCOMING_WINDOWS,
  catalogTotals, formatDateTime, formatTime, groupByDay, sanitizeSearch, sinceIso,
  type CatalogEntry, type CatalogResponse, type EmailChannel, type EmailLogRow, type EmailStatus,
  type TestResponse, type UpcomingEmail, type UpcomingResponse,
} from '@/lib/emailCenter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminNav } from '@/components/admin/AdminNav';

const FN = 'admin-email-center';
const TABS = ['catalogo', 'programmate', 'inviate'] as const;
type Tab = (typeof TABS)[number];

async function callCenter<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, { body });
  if (error) {
    // Il corpo della risposta di errore ha il messaggio in italiano
    const context = (error as { context?: Response }).context;
    const payload = context ? await context.json().catch(() => null) as { error?: string } | null : null;
    throw new Error(payload?.error ?? error.message);
  }
  return data as T;
}

type Preview = { title: string; subtitle: string; html: string | null; meta?: { label: string; value: string }[] };

function PreviewDialog({ preview, onClose }: { preview: Preview | null; onClose: () => void }) {
  return (
    <Dialog open={!!preview} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 break-words">{preview?.title}</DialogTitle>
          <DialogDescription className="break-words">{preview?.subtitle}</DialogDescription>
        </DialogHeader>
        {preview?.meta && (
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            {preview.meta.map((m) => (
              <div key={m.label} className="contents">
                <dt className="text-muted-foreground">{m.label}</dt>
                <dd className="break-words">{m.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {preview?.html ? (
          <iframe
            title={`Anteprima: ${preview.title}`}
            sandbox=""
            // Fuori dal tab: il focus iniziale va al pulsante di chiusura, così Esc chiude la finestra
            tabIndex={-1}
            srcDoc={preview.html}
            className="w-full h-[60vh] rounded-md border bg-white"
          />
        ) : (
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertDescription>
              Contenuto non salvato: è un&apos;email di sicurezza con link o codici d&apos;accesso, oppure identica per tutti
              (newsletter). L&apos;aspetto lo trovi nel Catalogo.
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChannelBadge({ channel }: { channel: EmailChannel }) {
  const variant = channel === 'none' ? 'destructive' : channel === 'email' || channel === 'push_email' ? 'default' : 'secondary';
  return <Badge variant={variant}>{CHANNEL_LABELS[channel]}</Badge>;
}

// ── Catalogo ─────────────────────────────────────────────────────────────────

function CatalogTab({ entries, onPreview }: { entries: CatalogEntry[]; onPreview: (p: Preview) => void }) {
  const [testing, setTesting] = useState<string | null>(null);

  const sendTest = async (entry: CatalogEntry) => {
    setTesting(entry.kind);
    try {
      const res = await callCenter<TestResponse>({ action: 'test', kind: entry.kind });
      if (res.ok) toast.success(`Email di prova inviata a ${res.to}`);
      else toast.error(`Prova non inviata: ${res.error ?? 'errore sconosciuto'}`);
    } catch (e) {
      toast.error(`Prova non inviata: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {entries.map((e) => (
        <Card key={e.kind} data-testid={`catalog-${e.kind}`} className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{AUDIENCE_LABELS[e.audience]}</Badge>
              <Badge variant="outline">{CATEGORY_LABELS[e.category]}</Badge>
              {e.sensitive && (
                <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3 w-3" /> Corpo non salvato</Badge>
              )}
            </div>
            <CardTitle className="text-base pt-1">{e.label}</CardTitle>
            <CardDescription>{e.trigger}</CardDescription>
          </CardHeader>
          <CardContent className="mt-auto space-y-3 text-sm">
            {e.schedule && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" /> {e.schedule}
              </p>
            )}
            <p className="break-words">
              <span className="text-muted-foreground">Oggetto: </span>{e.sample.subject}
            </p>
            <p className="text-muted-foreground">
              Ultimi 30 giorni: <strong className="text-foreground">{e.sent30d}</strong> inviate
              {e.failed30d > 0 && <> · <strong className="text-destructive">{e.failed30d}</strong> non inviate</>}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onPreview({
                  title: e.label,
                  subtitle: `Esempio con dati finti · Oggetto: ${e.sample.subject}`,
                  html: e.sample.html,
                })}
              >
                <Eye className="h-4 w-4 mr-2" /> Anteprima
              </Button>
              {e.audience !== 'esterno' && (
                <Button size="sm" variant="ghost" disabled={testing !== null} onClick={() => sendTest(e)}>
                  <Send className="h-4 w-4 mr-2" /> {testing === e.kind ? 'Invio…' : 'Inviami una prova'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Programmate ──────────────────────────────────────────────────────────────

function UpcomingTab({ days, onDays, items, loading, error }: {
  days: number;
  onDays: (d: number) => void;
  items: UpcomingEmail[];
  loading: boolean;
  error: string | null;
}) {
  const groups = useMemo(() => groupByDay(items), [items]);
  const emails = items.filter((i) => i.channel === 'email' || i.channel === 'push_email').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading ? 'Calcolo…' : `${items.length} invii previsti, ${emails} sicuramente via email`}
        </p>
        <Select value={String(days)} onValueChange={(v) => onDays(Number(v))}>
          <SelectTrigger className="w-[200px]" aria-label="Finestra"><SelectValue /></SelectTrigger>
          <SelectContent>
            {UPCOMING_WINDOWS.map((d) => <SelectItem key={d} value={String(d)}>Prossimi {d} giorni</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Alert>
        <CalendarClock className="h-4 w-4" />
        <AlertDescription>
          Previsione calcolata con le stesse regole dei job automatici (promemoria e solleciti di pagamento, fine pausa,
          report mensile, pulizia dati). Sondaggi, attestati, proposte e newsletter dipendono da eventi: li trovi nel Catalogo.
        </AlertDescription>
      </Alert>
      {error && (
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Nessun invio automatico previsto in questo periodo.</p>
      )}
      {groups.map((g) => (
        <section key={g.day} className="space-y-2">
          <h3 className="text-sm font-semibold capitalize">{g.label}</h3>
          {g.items.map((i, idx) => (
            <div key={`${i.kind}-${idx}`} data-testid="upcoming-item" className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{formatTime(i.scheduledFor)}</span>
                <span className="font-medium">{i.label}</span>
                <ChannelBadge channel={i.channel} />
              </div>
              <p className="break-words">
                {i.recipientName ?? 'Destinatario'}
                {i.recipientEmail && <span className="text-muted-foreground"> · {i.recipientEmail}</span>}
                {i.studentName && <span className="text-muted-foreground"> · studente: {i.studentName}</span>}
              </p>
              <p className="text-muted-foreground">{i.description}</p>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

// ── Inviate ──────────────────────────────────────────────────────────────────

type SentFilters = { kind: string; status: 'all' | EmailStatus; period: number; search: string };

function SentTab({ entries, onPreview }: { entries: CatalogEntry[]; onPreview: (p: Preview) => void }) {
  const [filters, setFilters] = useState<SentFilters>({ kind: 'all', status: 'all', period: 30, search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<EmailLogRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const labels = useMemo(() => Object.fromEntries(entries.map((e) => [e.kind, e.label])), [entries]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let query = emailLogClient
      .from('email_log')
      .select('id, kind, to_email, recipient_id, lead_id, subject, html, status, error, provider_id, source, created_at')
      .gte('created_at', sinceIso(filters.period))
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE); // una riga in più: c'è una pagina dopo?
    if (filters.kind !== 'all') query = query.eq('kind', filters.kind);
    if (filters.status !== 'all') query = query.eq('status', filters.status);
    const q = sanitizeSearch(filters.search);
    if (q) {
      // Per nome: profili che corrispondono, oltre all'indirizzo email (* = % in PostgREST)
      const { data: people } = q.includes('@')
        ? { data: [] as { id: string }[] }
        : await supabase.from('profiles').select('id').ilike('full_name', `*${q}*`).limit(50);
      const ids = (people ?? []).map((p) => p.id);
      query = ids.length > 0
        ? query.or(`to_email.ilike.*${q}*,recipient_id.in.(${ids.join(',')})`)
        : query.ilike('to_email', `*${q}*`);
    }
    const { data, error: queryError } = await query;
    if (queryError) {
      setRows([]);
      setHasMore(false);
      setError(/email_log|schema cache|does not exist/i.test(queryError.message)
        ? 'Il registro delle email non è ancora attivo: serve la migrazione 0057. Lo storico partirà da lì.'
        : `Caricamento non riuscito: ${queryError.message}`);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as EmailLogRow[];
    setHasMore(list.length > PAGE_SIZE);
    const pageRows = list.slice(0, PAGE_SIZE);

    // Nomi dei destinatari: profili con account, altrimenti il lead del CRM
    const profileIds = [...new Set(pageRows.map((r) => r.recipient_id).filter((x): x is string => !!x))];
    const leadIds = [...new Set(pageRows.filter((r) => !r.recipient_id && r.lead_id).map((r) => r.lead_id as string))];
    const [profilesRes, leadsRes] = await Promise.all([
      profileIds.length ? supabase.from('profiles').select('id, full_name').in('id', profileIds) : Promise.resolve({ data: [] }),
      leadIds.length ? supabase.from('crm_leads').select('id, full_name').in('id', leadIds) : Promise.resolve({ data: [] }),
    ]);
    const map: Record<string, string> = {};
    for (const p of (profilesRes.data ?? []) as { id: string; full_name: string | null }[]) if (p.full_name) map[p.id] = p.full_name;
    for (const l of (leadsRes.data ?? []) as { id: string; full_name: string | null }[]) if (l.full_name) map[l.id] = l.full_name;
    setNames(map);
    setRows(pageRows);
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);

  const update = (patch: Partial<SentFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  };

  const nameOf = (r: EmailLogRow) =>
    (r.recipient_id && names[r.recipient_id]) || (r.lead_id && names[r.lead_id]) || null;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Select value={filters.kind} onValueChange={(v) => update({ kind: v })}>
          <SelectTrigger aria-label="Tipo di email"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {entries.map((e) => <SelectItem key={e.kind} value={e.kind}>{e.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status} onValueChange={(v) => update({ status: v as SentFilters['status'] })}>
          <SelectTrigger aria-label="Esito"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli esiti</SelectItem>
            <SelectItem value="sent">Inviate</SelectItem>
            <SelectItem value="failed">Non inviate</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(filters.period)} onValueChange={(v) => update({ period: Number(v) })}>
          <SelectTrigger aria-label="Periodo"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SENT_PERIODS.map((d) => <SelectItem key={d} value={String(d)}>Ultimi {d} giorni</SelectItem>)}
          </SelectContent>
        </Select>
        <form
          className="flex gap-2"
          onSubmit={(ev) => { ev.preventDefault(); update({ search: searchInput }); }}
        >
          <Input
            value={searchInput}
            onChange={(ev) => setSearchInput(ev.target.value)}
            placeholder="Nome o email del destinatario"
            aria-label="Cerca destinatario"
          />
          <Button type="submit" size="icon" variant="outline" aria-label="Cerca"><Search className="h-4 w-4" /></Button>
        </form>
      </div>

      {error && (
        <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : !error && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessuna email con questi filtri. Lo storico parte dal rilascio del centro di controllo.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              data-testid="sent-item"
              className="w-full text-left rounded-lg border p-3 text-sm hover:bg-muted/50 space-y-1"
              onClick={() => onPreview({
                title: r.subject,
                subtitle: labels[r.kind] ?? r.kind,
                html: r.html,
                meta: [
                  { label: 'A', value: [nameOf(r), r.to_email].filter(Boolean).join(' · ') },
                  { label: 'Quando', value: formatDateTime(r.created_at) },
                  { label: 'Esito', value: r.status === 'sent' ? STATUS_LABELS.sent : `${STATUS_LABELS.failed}: ${r.error ?? 'errore sconosciuto'}` },
                  { label: 'Inviata da', value: r.source },
                ],
              })}
            >
              <div className="flex flex-wrap items-center gap-2">
                {r.status === 'sent'
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label={STATUS_LABELS.sent} />
                  : <XCircle className="h-4 w-4 text-destructive" aria-label={STATUS_LABELS.failed} />}
                <span className="font-medium break-words">{r.subject}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{labels[r.kind] ?? r.kind}</Badge>
                <span className="break-all">{[nameOf(r), r.to_email].filter(Boolean).join(' · ')}</span>
                <span>{formatDateTime(r.created_at)}</span>
                {r.status === 'failed' && <Badge variant="destructive">{STATUS_LABELS.failed}</Badge>}
              </div>
            </button>
          ))}
        </div>
      )}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Più recenti
          </Button>
          <span className="text-xs text-muted-foreground">Pagina {page + 1}</span>
          <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
            Meno recenti <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Pagina ───────────────────────────────────────────────────────────────────

export default function AdminEmail() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : 'catalogo';

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [days, setDays] = useState<number>(30);
  const [upcoming, setUpcoming] = useState<UpcomingEmail[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [upcomingError, setUpcomingError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      setCatalog(await callCenter<CatalogResponse>({ action: 'catalog' }));
    } catch (e) {
      setCatalogError(`Catalogo non disponibile: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadUpcoming = useCallback(async () => {
    setUpcomingLoading(true);
    setUpcomingError(null);
    try {
      setUpcoming((await callCenter<UpcomingResponse>({ action: 'upcoming', days })).items);
    } catch (e) {
      setUpcoming([]);
      setUpcomingError(`Previsione non disponibile: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUpcomingLoading(false);
    }
  }, [days]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);
  useEffect(() => { loadUpcoming(); }, [loadUpcoming]);

  const entries = useMemo(() => catalog?.entries ?? [], [catalog]);
  const totals = catalogTotals(entries);
  const upcomingEmails = upcoming.filter((i) => i.channel === 'email' || i.channel === 'push_email').length;

  const stats = [
    { label: 'Inviate negli ultimi 30 giorni', value: catalog?.logReady === false ? '—' : totals.sent, icon: MailCheck },
    { label: 'Non inviate negli ultimi 30 giorni', value: catalog?.logReady === false ? '—' : totals.failed, icon: XCircle },
    { label: `Email previste nei prossimi ${days} giorni`, value: upcomingLoading ? '…' : upcomingEmails, icon: CalendarClock },
    { label: 'Tipi di email', value: entries.length || '…', icon: Library },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Head><title>Email | Admin TECHLAND</title></Head>
      <AdminHeader />
      <AdminNav />
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="w-6 h-6 text-primary" /> Email
            </h1>
            <p className="text-sm text-muted-foreground">
              Cosa mandiamo a famiglie e staff, cosa partirà nei prossimi giorni e cosa è già partito.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { loadCatalog(); loadUpcoming(); }} disabled={catalogLoading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Aggiorna
          </Button>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <s.icon className="w-4 h-4 shrink-0" /> {s.label}
                </div>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {catalog?.logReady === false && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Il registro delle email non è ancora attivo (migrazione 0057 da applicare): catalogo e previsioni funzionano,
              lo storico delle email inviate partirà da lì.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={tab} onValueChange={(v) => setSearchParams(v === 'catalogo' ? {} : { tab: v }, { replace: true })}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="catalogo" className="flex-1 sm:flex-none">Catalogo</TabsTrigger>
            <TabsTrigger value="programmate" className="flex-1 sm:flex-none">Programmate</TabsTrigger>
            <TabsTrigger value="inviate" className="flex-1 sm:flex-none">Inviate</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo" className="pt-4">
            {catalogError ? (
              <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{catalogError}</AlertDescription></Alert>
            ) : catalogLoading && !catalog ? (
              <p className="text-sm text-muted-foreground">Caricamento…</p>
            ) : (
              <CatalogTab entries={entries} onPreview={setPreview} />
            )}
          </TabsContent>

          <TabsContent value="programmate" className="pt-4">
            <UpcomingTab days={days} onDays={setDays} items={upcoming} loading={upcomingLoading} error={upcomingError} />
          </TabsContent>

          <TabsContent value="inviate" className="pt-4">
            <SentTab entries={entries} onPreview={setPreview} />
          </TabsContent>
        </Tabs>
      </div>
      <PreviewDialog preview={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
