import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Camera, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AdminNav } from '@/components/admin/AdminNav';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import {
  MEDIA_PURPOSES,
  type MediaConsent,
  type MediaPurpose,
  consentKey,
  consentStatus,
  fetchMediaConsents,
  formatConsentDate,
  splitByConsent,
} from '@/lib/mediaConsents';

/**
 * Consensi foto e video dei minori, da controllare prima di registrare o
 * pubblicare. I consensi li danno i genitori dal loro profilo; qui l'admin
 * può solo registrare una revoca arrivata per email o telefono.
 */

type Student = { id: string; name: string; parentName: string | null };
type Group = { id: string; title: string; studentIds: string[] };
type ConsentEvent = { id: string; student_id: string; purpose: MediaPurpose; granted: boolean; decided_at: string };

const ALL_GROUPS = 'all';

export default function AdminMediaConsents() {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [consents, setConsents] = useState<Map<string, MediaConsent>>(new Map());
  const [events, setEvents] = useState<ConsentEvent[]>([]);
  const [purpose, setPurpose] = useState<MediaPurpose>('social');
  const [groupId, setGroupId] = useState<string>(ALL_GROUPS);

  const load = useCallback(async () => {
    setLoading(true);
    const [studentsRes, groupsRes, membersRes, eventsRes, consentMap] = await Promise.all([
      supabase.from('profiles').select('id, full_name, parent_id').eq('role', 'student').order('full_name'),
      supabase.from('student_groups').select('id, title').is('archived_at', null).order('title'),
      supabase.from('group_students').select('group_id, student_id'),
      supabase
        .from('media_consent_events' as never)
        .select('id, student_id, purpose, granted, decided_at')
        .order('decided_at', { ascending: false })
        .limit(30),
      fetchMediaConsents(),
    ]);

    const studentRows = studentsRes.data ?? [];
    const parentIds = [...new Set(studentRows.map((s) => s.parent_id).filter((id): id is string => !!id))];
    const { data: parents } = parentIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', parentIds)
      : { data: [] };
    const parentName = new Map((parents ?? []).map((p) => [p.id, p.full_name]));

    setStudents(
      studentRows.map((s) => ({
        id: s.id,
        name: s.full_name ?? 'Studente senza nome',
        parentName: s.parent_id ? parentName.get(s.parent_id) ?? null : null,
      })),
    );
    const members = membersRes.data ?? [];
    setGroups(
      (groupsRes.data ?? []).map((g) => ({
        id: g.id,
        title: g.title,
        studentIds: members.filter((m) => m.group_id === g.id).map((m) => m.student_id),
      })),
    );
    setConsents(consentMap);
    setEvents((eventsRes.data as ConsentEvent[] | null) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (groupId === ALL_GROUPS) return students;
    const ids = new Set(groups.find((g) => g.id === groupId)?.studentIds ?? []);
    return students.filter((s) => ids.has(s.id));
  }, [students, groups, groupId]);

  const { allowed, blocked } = useMemo(() => splitByConsent(visible, consents, purpose), [visible, consents, purpose]);
  const studentName = useMemo(() => new Map(students.map((s) => [s.id, s.name])), [students]);
  const purposeLabel = (id: MediaPurpose) => MEDIA_PURPOSES.find((p) => p.id === id)?.label ?? id;

  const recordRevocation = async (student: Student) => {
    const { error } = await supabase
      .from('media_consents' as never)
      .update({ granted: false } as never)
      .eq('student_id', student.id)
      .eq('purpose', purpose);
    if (error) {
      toast.error('Revoca non registrata', { description: error.message });
      return;
    }
    toast.success(`Revoca registrata per ${student.name}`);
    load();
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Camera className="w-6 h-6 text-primary" /> Consensi foto e video
            </h1>
            <p className="text-sm text-muted-foreground">
              Controlla qui prima di registrare una lezione o pubblicare foto e video. Ogni finalità ha un consenso a sé:
              chi non l&apos;ha dato non deve comparire, o va reso non riconoscibile.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" /> Aggiorna
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Tabs value={purpose} onValueChange={(v) => setPurpose(v as MediaPurpose)}>
            <TabsList className="flex-wrap h-auto">
              {MEDIA_PURPOSES.map((p) => (
                <TabsTrigger key={p.id} value={p.id}>
                  {p.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger className="sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_GROUPS}>Tutti gli studenti</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card className={blocked.length > 0 ? 'border-destructive/40' : 'border-primary/40'}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  {blocked.length > 0 ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  )}
                  {blocked.length > 0
                    ? `${blocked.length} su ${visible.length} non possono comparire`
                    : `Tutti i ${visible.length} studenti possono comparire`}
                </CardTitle>
                <CardDescription>{MEDIA_PURPOSES.find((p) => p.id === purpose)?.description}</CardDescription>
              </CardHeader>
              {blocked.length > 0 && (
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {blocked.map((s) => (
                      <Badge key={s.id} variant="destructive">
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Dettaglio</CardTitle>
                <CardDescription>
                  {allowed.length} con consenso · {blocked.length} senza consenso o con consenso revocato
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {visible.length === 0 && <p className="text-sm text-muted-foreground py-2">Nessuno studente in questo gruppo.</p>}
                {visible.map((s) => {
                  const consent = consents.get(consentKey(s.id, purpose));
                  const status = consentStatus(consent);
                  return (
                    <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        {s.parentName && <p className="text-xs text-muted-foreground">Genitore: {s.parentName}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {status === 'granted' && consent && (
                          <>
                            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                              Sì · dal {formatConsentDate(consent.decided_at)}
                            </Badge>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  Registra revoca
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Registrare la revoca?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Usalo quando il genitore di {s.name} ha revocato il consenso «{purposeLabel(purpose)}»
                                    per email o telefono. Potrà ridarlo solo il genitore dal suo profilo.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => recordRevocation(s)}>Registra revoca</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                        {status === 'revoked' && consent && (
                          <Badge variant="destructive">Revocato il {formatConsentDate(consent.decided_at)}</Badge>
                        )}
                        {status === 'none' && <Badge variant="outline">Non dato</Badge>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Ultime modifiche</CardTitle>
                <CardDescription>Storico dei consensi dati e revocati, conservato come prova.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {events.length === 0 && <p className="text-muted-foreground">Ancora nessun consenso registrato.</p>}
                {events.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{studentName.get(e.student_id) ?? 'Studente'}</span>
                      {' · '}
                      {purposeLabel(e.purpose)}
                    </span>
                    <span className="text-muted-foreground">
                      {e.granted ? 'Dato' : 'Revocato'} il {format(parseISO(e.decided_at), 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
