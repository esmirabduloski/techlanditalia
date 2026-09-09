import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Bell, Send, Smartphone, RefreshCw } from 'lucide-react';
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

    setNames(nameMap);
    setPeople(rows);
    setLogs(logRows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const totalDevices = useMemo(() => people.reduce((s, p) => s + p.devices, 0), [people]);

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
          <Button onClick={handleSend} disabled={sending}>
            <Send className="w-4 h-4 mr-2" />
            {sending ? 'Invio…' : 'Invia notifica'}
          </Button>
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
