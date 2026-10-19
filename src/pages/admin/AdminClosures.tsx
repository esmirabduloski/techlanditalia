import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { AdminNav } from '@/components/admin/AdminNav';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { AlertTriangle, CalendarOff, Flag, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { romeToday } from '@/lib/courseProposal';
import {
  MAX_NOTE_LENGTH,
  closureDays,
  closureDraftError,
  formatClosureRange,
  missingHolidays,
  nationalHolidays,
  schoolYearLabel,
  schoolYearOf,
  upcomingClosures,
  type SchoolClosure,
  type SchoolClosureDraft,
} from '@/lib/schoolClosures';
import { schoolClosuresClient } from '@/lib/schoolClosuresClient';

interface ScheduledLesson {
  id: string;
  lesson_number: number;
  lesson_date: string;
  group: { id: string; title: string; status: string | null } | null;
}

const EMPTY_DRAFT: SchoolClosureDraft = { title: '', start_date: '', end_date: '', note: '' };

export default function AdminClosures() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const today = romeToday();
  const schoolYear = schoolYearOf(today);

  const [closures, setClosures] = useState<SchoolClosure[]>([]);
  const [lessons, setLessons] = useState<ScheduledLesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [draft, setDraft] = useState<SchoolClosureDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingYear, setLoadingYear] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/admin/login');
  }, [user, isAdmin, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    const { data, error } = await schoolClosuresClient
      .from('school_closures')
      .select('*')
      .order('start_date');
    if (error) {
      setLoadError(error.message);
      setIsLoading(false);
      return;
    }
    const all = data ?? [];
    setClosures(all);
    setLoadError(null);

    // Lezioni già in calendario nei giorni di chiusura futuri: vanno spostate
    const upcoming = upcomingClosures(all, today);
    if (upcoming.length > 0) {
      const from = upcoming[0].start_date < today ? today : upcoming[0].start_date;
      const to = upcoming.reduce((max, c) => (c.end_date > max ? c.end_date : max), from);
      const { data: scheduled } = await supabase
        .from('group_lesson_schedule')
        .select('id, lesson_number, lesson_date, group:group_id ( id, title, status )')
        .gte('lesson_date', from)
        .lte('lesson_date', to)
        .order('lesson_date');
      setLessons(((scheduled ?? []) as unknown as ScheduledLesson[]).filter((l) => l.group && l.group.status !== 'archived'));
    } else {
      setLessons([]);
    }
    setIsLoading(false);
  }, [today]);

  useEffect(() => {
    if (user && isAdmin) fetchData();
  }, [user, isAdmin, fetchData]);

  const visible = useMemo(
    () => (showPast ? [...closures].sort((a, b) => b.start_date.localeCompare(a.start_date)) : upcomingClosures(closures, today)),
    [closures, showPast, today],
  );

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  };

  const startEdit = (c: SchoolClosure) => {
    setEditingId(c.id);
    setDraft({ title: c.title, start_date: c.start_date, end_date: c.end_date, note: c.note ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = async () => {
    const clean: SchoolClosureDraft = {
      title: draft.title.trim(),
      start_date: draft.start_date,
      end_date: draft.end_date || draft.start_date,
      note: draft.note?.trim() || null,
    };
    const problem = closureDraftError(clean);
    if (problem) {
      toast({ title: 'Controlla la chiusura', description: problem, variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    const { error } = editingId
      ? await schoolClosuresClient.from('school_closures').update(clean).eq('id', editingId)
      : await schoolClosuresClient.from('school_closures').insert(clean);
    setIsSaving(false);
    if (error) {
      const duplicate = error.code === '23505';
      toast({
        title: 'Errore',
        description: duplicate ? 'Esiste già una chiusura con questo nome che inizia lo stesso giorno' : error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: editingId ? 'Chiusura aggiornata' : 'Chiusura aggiunta', description: `${clean.title}: i genitori la vedono nell'area riservata` });
    resetForm();
    fetchData();
  };

  const handleDelete = async (c: SchoolClosure) => {
    const { error } = await schoolClosuresClient.from('school_closures').delete().eq('id', c.id);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    if (editingId === c.id) resetForm();
    toast({ title: 'Chiusura eliminata', description: c.title });
    fetchData();
  };

  const handleAddHolidays = async (startYear: number) => {
    const toAdd = missingHolidays(nationalHolidays(startYear), closures, today);
    if (toAdd.length === 0) {
      toast({ title: 'Niente da aggiungere', description: `Le festività ${schoolYearLabel(startYear)} sono già nel calendario` });
      return;
    }
    setLoadingYear(startYear);
    const { error } = await schoolClosuresClient
      .from('school_closures')
      .upsert(toAdd, { onConflict: 'start_date,title', ignoreDuplicates: true });
    setLoadingYear(null);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: `Aggiunte ${toAdd.length} festività`, description: toAdd.map((h) => h.title).join(', ') });
    fetchData();
  };

  if (authLoading || (isAdmin && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />
      <AdminNav />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <CalendarOff className="w-8 h-8 text-primary" />
            Chiusure e festività
          </h1>
          <p className="text-muted-foreground mt-1">
            I genitori le vedono in anticipo nell'area riservata e 3 giorni prima ricevono un avviso (push ed email) se in quei giorni avrebbero lezione.
            Quando generi il calendario di un gruppo, questi giorni vengono saltati.
          </p>
        </div>

        {loadError && (
          <Card className="border-destructive/50">
            <CardContent className="py-4 text-sm text-destructive">
              Non riesco a leggere le chiusure ({loadError}). Se la migrazione 0060_school_closures non è ancora applicata, va applicata da Lovable.
            </CardContent>
          </Card>
        )}

        <Card className={editingId ? 'ring-2 ring-primary' : undefined}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {editingId ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
              {editingId ? 'Modifica chiusura' : 'Nuova chiusura'}
            </CardTitle>
            <CardDescription>Per un giorno solo lascia vuoto "Fino al".</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              noValidate
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSave();
              }}
            >
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="closure-title">Nome</Label>
                <Input
                  id="closure-title"
                  value={draft.title}
                  maxLength={120}
                  placeholder="Vacanze di Natale"
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closure-start">Dal</Label>
                <Input
                  id="closure-start"
                  type="date"
                  value={draft.start_date}
                  onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closure-end">Fino al (compreso)</Label>
                <Input
                  id="closure-end"
                  type="date"
                  value={draft.end_date}
                  min={draft.start_date || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, end_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="closure-note">Nota per i genitori (facoltativa)</Label>
                <Textarea
                  id="closure-note"
                  value={draft.note ?? ''}
                  maxLength={MAX_NOTE_LENGTH}
                  rows={2}
                  placeholder="Le lezioni riprendono giovedì 7 gennaio"
                  onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                />
              </div>
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:col-span-2">
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annulla
                  </Button>
                )}
                <Button type="submit" disabled={isSaving || !!loadError}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : editingId ? <Save className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {editingId ? 'Salva modifiche' : 'Aggiungi chiusura'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Flag className="w-5 h-5 text-primary" />
              Festività nazionali
            </CardTitle>
            <CardDescription>
              Aggiunge in un clic le festività dell'anno scolastico, Pasqua e Pasquetta comprese (e San Francesco il 4 ottobre, festa dal 2026).
              Salta quelle passate, quelle già presenti e quelle già dentro un'altra chiusura.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-2">
            {[schoolYear, schoolYear + 1].map((year) => (
              <Button
                key={year}
                variant="outline"
                onClick={() => handleAddHolidays(year)}
                disabled={loadingYear !== null || !!loadError}
              >
                {loadingYear === year ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Flag className="w-4 h-4 mr-2" />}
                Festività {schoolYearLabel(year)}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-lg">{showPast ? 'Tutte le chiusure' : 'In programma'}</CardTitle>
              <CardDescription>
                {showPast ? 'Dalla più recente' : 'Quelle che i genitori vedono adesso, dalla più vicina'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0 min-h-[44px]">
              <Label htmlFor="closures-show-past" className="text-sm text-muted-foreground cursor-pointer">
                Anche passate
              </Label>
              <Switch id="closures-show-past" checked={showPast} onCheckedChange={setShowPast} />
            </div>
          </CardHeader>
          <CardContent>
            {visible.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                Nessuna chiusura in programma. Aggiungine una o carica le festività nazionali.
              </p>
            ) : (
              <ul className="space-y-3 list-none p-0 m-0">
                {visible.map((c) => {
                  const days = closureDays(c);
                  const isPast = c.end_date < today;
                  const affected = isPast ? [] : lessons.filter((l) => c.start_date <= l.lesson_date && l.lesson_date <= c.end_date);
                  return (
                    <li key={c.id} className={`rounded-xl border p-3 ${isPast ? 'bg-muted/40' : 'bg-card'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`font-semibold ${isPast ? 'text-muted-foreground' : ''}`}>{c.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatClosureRange(c, today)}
                            {days > 1 && ` · ${days} giorni`}
                          </p>
                          {c.note && <p className="text-sm text-muted-foreground mt-1 italic">"{c.note}"</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.start_date <= today && !isPast && <Badge className="mr-1">In corso</Badge>}
                          {c.notified_at && !isPast && (
                            <Badge variant="outline" className="mr-1 hidden sm:inline-flex" title="Avviso push ed email inviato alle famiglie">
                              Famiglie avvisate il {format(new Date(c.notified_at), 'd/M')}
                            </Badge>
                          )}
                          <Button variant="ghost" size="icon" aria-label={`Modifica ${c.title}`} onClick={() => startEdit(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" aria-label={`Elimina ${c.title}`} className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminare "{c.title}"?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Sparisce dall'area genitore e non verrà più saltata nei nuovi calendari. Le lezioni già in calendario non cambiano
                                  {c.notified_at ? " e le famiglie già avvisate non ricevono una correzione: se serve, scrivi tu." : "."}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(c)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Elimina
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {affected.length > 0 && (
                        <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/40 p-3 text-sm">
                          <p className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {affected.length === 1 ? '1 lezione in calendario' : `${affected.length} lezioni in calendario`} in questi giorni
                          </p>
                          <ul className="mt-1 list-none p-0 m-0 text-muted-foreground">
                            {affected.map((l) => (
                              <li key={l.id}>
                                {l.group?.title} · lezione {l.lesson_number} ·{' '}
                                <span className="capitalize">{format(new Date(`${l.lesson_date}T12:00:00`), 'EEE d MMM', { locale: it })}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Spostale dal calendario del gruppo in <Link to="/admin/gruppi" className="underline">Gruppi</Link>: i genitori le vedono ancora in quei giorni.
                          </p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
