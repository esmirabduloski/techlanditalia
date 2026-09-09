import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Bell, Send, Smartphone, RefreshCw, BookmarkPlus, Trash2, Users, GraduationCap, Clock, Inbox } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminNav } from '@/components/admin/AdminNav';

type DeviceRow = {
  user_id: string;
  platform: string | null;
  last_seen_at: string;
};

type PersonRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  devices: number;
  platforms: string[];
  lastSeen: string | null;
};

type LogRow = {
  id: string;
  user_id: string;
  notification_type: string;
  title: string | null;
  body: string | null;
  success_count: number;
  failure_count: number;
  created_at: string;
};

type TemplateRow = { id: string; title: string; body: string };

type Stats = {
  reminders24h: number;
  reminders1h: number;
  manual: number;
  alerts: number;
};


export default function AdminPushNotifications() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [audience, setAudience] = useState<'selected' | 'all' | 'parents' | 'teachers'>('selected');
  const [title, setTitle] = useState('Avviso TECHLAND');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [stats, setStats] = useState<Stats>({ reminders24h: 0, reminders1h: 0, manual: 0, alerts: 0 });

  const countLogs = async (type: string) => {
    const { count } = await supabase
      .from('push_notification_log')
      .select('id', { count: 'exact', head: true })
      .eq('notification_type', type);
    return count ?? 0;
  };

  const load = async () => {
    setLoading(true);
    const [devicesRes, logsRes] = await Promise.all([
      supabase.from('push_devices').select('user_id, platform, last_seen_at'),
      supabase
        .from('push_notification_log')
        .select('id, user_id, notification_type, title, body, success_count, failure_count, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const devices = (devicesRes.data ?? []) as DeviceRow[];
    const logRows = (logsRes.data ?? []) as LogRow[];

    const userIds = Array.from(new Set([
      ...devices.map((d) => d.user_id),
      ...logRows.map((l) => l.user_id),
    ]));

    let profiles: { id: string; full_name: string; email: string | null; role: string }[] = [];
    let teacherIds = new Set<string>();
    if (userIds.length > 0) {
      const [profRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, role').in('id', userIds),
        supabase.from('user_roles').select('user_id').eq('role', 'teacher').in('user_id', userIds),
      ]);
      profiles = (profRes.data ?? []) as typeof profiles;
      teacherIds = new Set((rolesRes.data ?? []).map((r) => r.user_id as string));
    }

    const nameMap: Record<string, string> = {};
    profiles.forEach((p) => { nameMap[p.id] = p.full_name; });

    const rows: PersonRow[] = profiles
      .filter((p) => devices.some((d) => d.user_id === p.id))
      .map((p) => {
        const mine = devices.filter((d) => d.user_id === p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          email: p.email,
          role: teacherIds.has(p.id) ? 'insegnante' : p.role,
          devices: mine.length,
          platforms: Array.from(new Set(mine.map((d) => d.platform ?? 'sconosciuto'))),
          lastSeen: mine.map((d) => d.last_seen_at).sort().reverse()[0] ?? null,
        };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    const [r24, r1, manual, leadAlerts, contactAlerts, tplRes] = await Promise.all([
      countLogs('lesson_reminder_24h'),
      countLogs('lesson_reminder_1h'),
      countLogs('manual_admin'),
      countLogs('new_lead_booking'),
      countLogs('new_contact_form'),
      supabase.from('push_templates').select('id, title, body').order('created_at', { ascending: false }),
    ]);

    setStats({ reminders24h: r24, reminders1h: r1, manual, alerts: leadAlerts + contactAlerts });
    setTemplates((tplRes.data ?? []) as TemplateRow[]);
    setNames(nameMap);
    setPeople(rows);
    setLogs(logRows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalDevices = useMemo(() => people.reduce((s, p) => s + p.devices, 0), [people]);
  const parentsCount = useMemo(() => people.filter((p) => p.role === 'parent').length, [people]);
  const teachersCount = useMemo(() => people.filter((p) => p.role === 'insegnante').length, [people]);

  const handleSaveTemplate = async () => {
    if (!body.trim()) {
      toast.error('Scrivi prima il messaggio da salvare');
      return;
    }
    const { data, error } = await supabase
      .from('push_templates')
      .insert({ title: title.trim() || 'Avviso TECHLAND', body: body.trim() })
      .select('id, title, body')
      .single();
    if (error) {
      toast.error('Salvataggio non riuscito: ' + error.message);
      return;
    }
    setTemplates((prev) => [data as TemplateRow, ...prev]);
    toast.success('Messaggio salvato nei predefiniti');
  };

  const handleDeleteTemplate = async (id: string) => {
    const { error } = await supabase.from('push_templates').delete().eq('id', id);
    if (error) {
      toast.error('Eliminazione non riuscita: ' + error.message);
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };


  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSend = async () => {
    if (!body.trim()) {
      toast.error('Scrivi il testo della notifica');
      return;
    }
    if (audience === 'selected' && selected.length === 0) {
      toast.error('Seleziona almeno una persona');
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke('admin-send-push', {
      body: audience === 'selected'
        ? { title, body, userIds: selected }
        : { title, body, audience },
    });
    setSending(false);

    if (error) {
      toast.error('Invio non riuscito: ' + error.message);
      return;
    }
    const result = data as { sent?: number; failed?: number; error?: string };
    if (result?.error) {
      toast.error('Invio non riuscito: ' + result.error);
      return;
    }
    toast.success(`Notifiche inviate: ${result.sent ?? 0}${result.failed ? ` (${result.failed} non riuscite)` : ''}`);
    setBody('');
    load();
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Notifiche push | Admin TECHLAND</title></Helmet>
      <AdminHeader />
      <AdminNav />
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" /> Notifiche push
          </h1>
          <p className="text-sm text-muted-foreground">
            {people.length} persone con notifiche attive · {totalDevices} dispositivi
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="w-4 h-4 mr-2" /> Aggiorna
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Genitori con notifiche', value: parentsCount, icon: Users },
          { label: 'Insegnanti con notifiche', value: teachersCount, icon: GraduationCap },
          { label: 'Promemoria 24h inviati', value: stats.reminders24h, icon: Clock },
          { label: 'Promemoria 1h inviati', value: stats.reminders1h, icon: Clock },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <s.icon className="w-4 h-4" /> {s.label}
              </div>
              <p className="text-2xl font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Send className="w-4 h-4" /> Avvisi manuali inviati
            </div>
            <p className="text-2xl font-bold mt-1">{stats.manual}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Inbox className="w-4 h-4" /> Avvisi nuovi contatti/prenotazioni
            </div>
            <p className="text-2xl font-bold mt-1">{stats.alerts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Smartphone className="w-4 h-4" /> Dispositivi totali
            </div>
            <p className="text-2xl font-bold mt-1">{totalDevices}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
              <Bell className="w-4 h-4" /> Persone attive
            </div>
            <p className="text-2xl font-bold mt-1">{people.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Chi ha attivato le notifiche</CardTitle>
          <CardDescription>Seleziona le persone a cui inviare un avviso manuale.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Caricamento…</p>
          ) : people.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuno ha ancora attivato le notifiche.
            </p>
          ) : (
            <div className="space-y-2">
              {people.map((p) => (
                <label
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.includes(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <div className="flex-1 min-w-[160px]">
                    <p className="font-medium text-sm">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground break-all">{p.email ?? '—'}</p>
                  </div>
                  <Badge variant="secondary" className="capitalize">{p.role}</Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Smartphone className="w-3 h-3" /> {p.devices} · {p.platforms.join(', ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Ultimo uso: {fmt(p.lastSeen)}</span>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Invia un avviso manuale</CardTitle>
          <CardDescription>Arriva solo a chi ha attivato le notifiche.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Destinatari</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as typeof audience)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="selected">Solo i selezionati ({selected.length})</SelectItem>
                  <SelectItem value="all">Tutti</SelectItem>
                  <SelectItem value="parents">Tutti i genitori</SelectItem>
                  <SelectItem value="teachers">Tutti gli insegnanti</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="push-title">Titolo</Label>
              <Input id="push-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Messaggi predefiniti</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value=""
                  onValueChange={(id) => {
                    const t = templates.find((x) => x.id === id);
                    if (t) { setTitle(t.title); setBody(t.body); }
                  }}
                >
                  <SelectTrigger className="sm:max-w-md">
                    <SelectValue placeholder="Scegli un messaggio salvato" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title} — {t.body.slice(0, 40)}{t.body.length > 40 ? '…' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {templates.map((t) => (
                  <Badge key={t.id} variant="secondary" className="flex items-center gap-1">
                    {t.title}
                    <button
                      type="button"
                      aria-label={`Elimina messaggio predefinito ${t.title}`}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteTemplate(t.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="push-body">Messaggio</Label>
            <Textarea
              id="push-body"
              value={body}
              maxLength={300}
              rows={3}
              placeholder="Es. La lezione di domani è spostata alle 18:00."
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSend} disabled={sending}>
              <Send className="w-4 h-4 mr-2" />
              {sending ? 'Invio…' : 'Invia notifica'}
            </Button>
            <Button variant="outline" onClick={handleSaveTemplate}>
              <BookmarkPlus className="w-4 h-4 mr-2" /> Salva come predefinito
            </Button>
          </div>

        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Ultimi invii</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun invio registrato.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{names[l.user_id] ?? 'Utente'}</span>
                    <Badge variant="outline">{l.notification_type}</Badge>
                    <span className="text-xs text-muted-foreground">{fmt(l.created_at)}</span>
                    <Badge variant={l.failure_count > 0 ? 'destructive' : 'secondary'}>
                      {l.success_count} ok / {l.failure_count} ko
                    </Badge>
                  </div>
                  {l.body && <p className="text-xs text-muted-foreground mt-1">{l.body}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
