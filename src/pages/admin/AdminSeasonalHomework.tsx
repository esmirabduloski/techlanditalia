import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import {
  PlaceAllDialog,
  PlaceDialog,
  ThemeDialog,
  type PlaceAllRow,
  type SeasonalLesson,
} from '@/components/admin/SeasonalDialogs';
import {
  ArrowRightLeft, CalendarPlus, Loader2, MonitorPlay, Pencil, Plus, Sparkles, Trash2, Undo2, Wand2,
} from 'lucide-react';
import { addDaysIso, romeToday } from '@/lib/courseProposal';
import {
  groupLessonStatus,
  seasonalPrefill,
  suggestLesson,
  themeDraftError,
  type GroupHint,
  type SeasonalTheme,
  type SeasonalThemeDraft,
} from '@/lib/seasonalHomework';
import { fetchSeasonalThemes, seasonalClient, type SeasonalHomeworkRow } from '@/lib/seasonalHomeworkClient';

interface CourseRow {
  id: string;
  title: string;
  emoji: string;
  is_visible: boolean;
}

type Variant = Pick<SeasonalHomeworkRow, 'id' | 'title' | 'seasonal_theme_id' | 'course_id' | 'lesson_id' | 'due_date'>;

// La scadenza si salva come nell'editor dei compiti: mezzanotte UTC del giorno scelto
const dueToDb = (due: string) => (due ? new Date(due).toISOString() : null);
const dueFromDb = (due: string | null) => (due ? due.split('T')[0] : '');

export default function AdminSeasonalHomework() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = romeToday();

  const [themes, setThemes] = useState<SeasonalTheme[] | null>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [lessons, setLessons] = useState<SeasonalLesson[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [submissionCounts, setSubmissionCounts] = useState<Map<string, number>>(new Map());
  const [hintsByCourse, setHintsByCourse] = useState<Map<string, GroupHint[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [themeDialog, setThemeDialog] = useState<{ open: boolean; editing: boolean }>({ open: false, editing: false });
  const [placing, setPlacing] = useState<Variant | null>(null);
  const [placeAllOpen, setPlaceAllOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/admin/login');
  }, [user, isAdmin, authLoading, navigate]);

  const fetchData = useCallback(async () => {
    const themeList = await fetchSeasonalThemes();
    setThemes(themeList);
    if (themeList === null) {
      setIsLoading(false);
      return;
    }

    const [coursesRes, lessonsRes, variantsRes, groupsRes] = await Promise.all([
      supabase.from('courses').select('id, title, emoji, is_visible').order('title'),
      supabase.from('lessons').select('id, course_id, lesson_number, title').order('lesson_number'),
      themeList.length > 0
        ? seasonalClient
            .from('homework')
            .select('id, title, seasonal_theme_id, course_id, lesson_id, due_date')
            .in('seasonal_theme_id', themeList.map((t) => t.id))
        : Promise.resolve({ data: [] as Variant[], error: null }),
      supabase.from('student_groups').select('id, course_id, title, status').neq('status', 'archived'),
    ]);

    const variantList = (variantsRes.data ?? []) as Variant[];
    setCourses((coursesRes.data ?? []) as CourseRow[]);
    setLessons((lessonsRes.data ?? []) as SeasonalLesson[]);
    setVariants(variantList);

    const ids = variantList.map((v) => v.id);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: subs } = await supabase.from('homework_submissions').select('homework_id').in('homework_id', ids);
      for (const s of subs ?? []) counts.set(s.homework_id, (counts.get(s.homework_id) ?? 0) + 1);
    }
    setSubmissionCounts(counts);

    // Dove sono i gruppi di ogni corso: aiuta a scegliere la lezione giusta
    const groups = groupsRes.data ?? [];
    const hints = new Map<string, GroupHint[]>();
    if (groups.length > 0) {
      const { data: schedule } = await supabase
        .from('group_lesson_schedule')
        .select('group_id, lesson_number, lesson_date')
        .in('group_id', groups.map((g) => g.id))
        .gte('lesson_date', addDaysIso(today, -60))
        .lte('lesson_date', addDaysIso(today, 90));
      const statuses = groupLessonStatus(schedule ?? [], today);
      for (const g of groups) {
        const status = statuses.get(g.id);
        if (!status) continue;
        hints.set(g.course_id, [...(hints.get(g.course_id) ?? []), { ...status, title: g.title }]);
      }
    }
    setHintsByCourse(hints);
    setIsLoading(false);
  }, [today]);

  useEffect(() => {
    if (user && isAdmin) fetchData();
  }, [user, isAdmin, fetchData]);

  const theme = useMemo(
    () => themes?.find((t) => t.id === searchParams.get('tema')) ?? themes?.[0] ?? null,
    [themes, searchParams],
  );
  const selectTheme = (id: string) => setSearchParams({ tema: id }, { replace: true });
  const themeDraft = useMemo<SeasonalThemeDraft | null>(
    () => (theme ? { name: theme.name, emoji: theme.emoji, prompt: theme.prompt, period_hint: theme.period_hint } : null),
    [theme],
  );

  const themeVariants = useMemo(
    () => new Map(variants.filter((v) => v.seasonal_theme_id === theme?.id).map((v) => [v.course_id!, v])),
    [variants, theme],
  );
  const lessonsByCourse = useMemo(() => {
    const map = new Map<string, SeasonalLesson[]>();
    for (const l of lessons) map.set(l.course_id, [...(map.get(l.course_id) ?? []), l]);
    return map;
  }, [lessons]);
  const lessonById = useMemo(() => new Map(lessons.map((l) => [l.id, l])), [lessons]);

  const missingCourses = courses.filter((c) => !themeVariants.has(c.id));
  const placed = [...themeVariants.values()].filter((v) => v.lesson_id);

  const suggestedLessonId = (courseId: string): string | null => {
    const courseLessons = lessonsByCourse.get(courseId) ?? [];
    const n = suggestLesson(hintsByCourse.get(courseId) ?? [], courseLessons.map((l) => l.lesson_number));
    return courseLessons.find((l) => l.lesson_number === n)?.id ?? null;
  };

  const courseLabel = (courseId: string) => {
    const c = courses.find((x) => x.id === courseId);
    return c ? `${c.emoji} ${c.title}` : 'Corso';
  };

  const fail = (message: string) => {
    toast({ title: 'Errore', description: message, variant: 'destructive' });
    return false;
  };

  // --- Temi ----------------------------------------------------------------

  const saveTheme = async (draft: SeasonalThemeDraft): Promise<boolean> => {
    const editing = themeDialog.editing && theme;
    const others = (themes ?? []).filter((t) => !editing || t.id !== theme.id);
    const problem = themeDraftError(draft, others);
    if (problem) return fail(problem);

    const clean = {
      name: draft.name.trim(),
      emoji: draft.emoji.trim() || '✨',
      prompt: draft.prompt.trim(),
      period_hint: draft.period_hint?.trim() || null,
    };
    if (editing) {
      const { error } = await seasonalClient.from('seasonal_themes').update(clean).eq('id', theme.id);
      if (error) return fail(error.message);
      toast({ title: 'Tema aggiornato', description: `${clean.emoji} ${clean.name}` });
      await fetchData();
      return true;
    }
    const sortOrder = Math.max(0, ...(themes ?? []).map((t) => t.sort_order)) + 1;
    const { data, error } = await seasonalClient
      .from('seasonal_themes')
      .insert({ ...clean, sort_order: sortOrder })
      .select()
      .single();
    if (error) return fail(error.code === '23505' ? `Esiste già un tema "${clean.name}"` : error.message);
    toast({ title: 'Tema creato', description: `${clean.emoji} ${clean.name}: ora crea i compiti dei corsi` });
    await fetchData();
    if (data) selectTheme(data.id);
    return true;
  };

  const deleteTheme = async (t: SeasonalTheme) => {
    const { error } = await seasonalClient.from('seasonal_themes').delete().eq('id', t.id);
    if (error) return fail(error.message);
    toast({ title: 'Tema eliminato', description: `${t.emoji} ${t.name}` });
    setSearchParams({}, { replace: true });
    fetchData();
  };

  // --- Compiti -------------------------------------------------------------

  const createDrafts = async () => {
    if (!theme || missingCourses.length === 0) return;
    setBusy('drafts');
    const prefill = seasonalPrefill(theme);
    const { error } = await seasonalClient.from('homework').insert(
      missingCourses.map((c) => ({
        ...prefill,
        seasonal_theme_id: theme.id,
        course_id: c.id,
        lesson_id: null,
        points_reward: 25,
        attachments: [],
      })),
    );
    setBusy(null);
    if (error) return fail(error.message);
    toast({
      title: missingCourses.length === 1 ? 'Creata 1 bozza' : `Create ${missingCourses.length} bozze`,
      description: 'Sono in archivio: personalizzale e poi inseriscile in una lezione',
    });
    fetchData();
  };

  const place = async (variant: Variant, lessonId: string, due: string): Promise<boolean> => {
    const { error } = await seasonalClient
      .from('homework')
      .update({ lesson_id: lessonId, due_date: dueToDb(due) })
      .eq('id', variant.id);
    if (error) return fail(error.message);
    const lesson = lessonById.get(lessonId);
    toast({
      title: variant.lesson_id ? 'Compito spostato' : 'Compito inserito',
      description: `${courseLabel(variant.course_id!)} · L${lesson?.lesson_number}: ${lesson?.title}`,
    });
    fetchData();
    return true;
  };

  const placeAll = async (assignments: { homeworkId: string; lessonId: string }[], due: string): Promise<boolean> => {
    const results = await Promise.all(
      assignments.map(({ homeworkId, lessonId }) =>
        seasonalClient
          .from('homework')
          .update(due ? { lesson_id: lessonId, due_date: dueToDb(due) } : { lesson_id: lessonId })
          .eq('id', homeworkId),
      ),
    );
    const failed = results.filter((r) => r.error);
    fetchData();
    if (failed.length > 0) return fail(`${failed.length} corsi non aggiornati: ${failed[0].error!.message}`);
    toast({
      title: `${theme?.emoji} ${theme?.name} inserito`,
      description: assignments.length === 1 ? 'In 1 corso' : `In ${assignments.length} corsi`,
    });
    return true;
  };

  const removeFromCourse = async (variants: Variant[]) => {
    if (variants.length === 0) return;
    setBusy('remove');
    const { error } = await seasonalClient
      .from('homework')
      .update({ lesson_id: null })
      .in('id', variants.map((v) => v.id));
    setBusy(null);
    if (error) return fail(error.message);
    toast({
      title: variants.length === 1 ? 'Compito tolto dal corso' : `Tolto da ${variants.length} corsi`,
      description: 'È tornato in archivio, pronto per la prossima volta',
    });
    fetchData();
  };

  const deleteVariant = async (variant: Variant) => {
    const { error } = await seasonalClient.from('homework').delete().eq('id', variant.id);
    if (error) return fail(error.message);
    toast({ title: 'Compito eliminato', description: courseLabel(variant.course_id!) });
    fetchData();
  };

  const placeAllRows: PlaceAllRow[] = useMemo(
    () =>
      courses
        .filter((c) => themeVariants.has(c.id))
        .map((c) => {
          const v = themeVariants.get(c.id)!;
          return {
            homeworkId: v.id,
            courseLabel: `${c.emoji} ${c.title}`,
            lessons: lessonsByCourse.get(c.id) ?? [],
            defaultLessonId: v.lesson_id ?? suggestedLessonId(c.id),
            hints: hintsByCourse.get(c.id) ?? [],
          };
        }),
    // suggestedLessonId dipende solo da lessonsByCourse e hintsByCourse
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses, themeVariants, lessonsByCourse, hintsByCourse],
  );

  if (authLoading || (isAdmin && isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  const themeLabel = theme ? `${theme.emoji} ${theme.name}` : '';
  const editorBase = theme ? `/admin/compiti-stagionali/${theme.id}` : '';

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />
      <AdminNav />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" />
            Compiti stagionali
          </h1>
          <p className="text-muted-foreground mt-1">
            Ogni tema ha un compito per corso. Quando arriva la stagione lo inserisci in una lezione e gli alunni lo trovano come compito per casa.
            Quando finisce lo togli: torna in archivio, pronto per l'anno prossimo, e le consegne restano da correggere.
          </p>
        </div>

        {themes === null ? (
          <Card className="border-destructive/50">
            <CardContent className="py-4 text-sm text-destructive">
              La sezione non è ancora attiva: Lovable deve applicare la migrazione 0066_seasonal_homework.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Temi stagionali">
              {themes.map((t) => {
                const active = t.id === theme?.id;
                const inCourses = variants.filter((v) => v.seasonal_theme_id === t.id && v.lesson_id).length;
                return (
                  <Button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    variant={active ? 'default' : 'outline'}
                    className="min-h-[44px]"
                    onClick={() => selectTheme(t.id)}
                  >
                    <span className="mr-1.5">{t.emoji}</span>
                    {t.name}
                    {inCourses > 0 && (
                      <Badge variant={active ? 'secondary' : 'default'} className="ml-2" title="Corsi in cui è inserito">
                        {inCourses}
                      </Badge>
                    )}
                  </Button>
                );
              })}
              <Button variant="ghost" className="min-h-[44px]" onClick={() => setThemeDialog({ open: true, editing: false })}>
                <Plus className="w-4 h-4 mr-1.5" />
                Nuovo tema
              </Button>
            </div>

            {theme && (
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="text-xl flex flex-wrap items-center gap-2">
                      {themeLabel}
                      {theme.period_hint && <Badge variant="outline">{theme.period_hint}</Badge>}
                    </CardTitle>
                    <CardDescription className="mt-2 whitespace-pre-line">
                      {theme.prompt || 'Nessuna richiesta standard: aggiungila per partire più veloce in ogni corso.'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => setThemeDialog({ open: true, editing: true })}>
                      <Pencil className="w-4 h-4 mr-1.5" />
                      Modifica tema
                    </Button>
                    {themeVariants.size === 0 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Elimina il tema ${theme.name}`} className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Eliminare il tema {themeLabel}?</AlertDialogTitle>
                            <AlertDialogDescription>Non ha compiti nei corsi, quindi non si perde nient'altro.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTheme(theme)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row flex-wrap gap-2">
                  {missingCourses.length > 0 && (
                    <Button variant="outline" onClick={createDrafts} disabled={busy !== null}>
                      {busy === 'drafts' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      Crea bozze per tutti i corsi ({missingCourses.length})
                    </Button>
                  )}
                  {themeVariants.size > 0 && (
                    <Button onClick={() => setPlaceAllOpen(true)} disabled={busy !== null}>
                      <CalendarPlus className="w-4 h-4 mr-2" />
                      Inserisci in tutti i corsi
                    </Button>
                  )}
                  {placed.length > 0 && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" disabled={busy !== null}>
                          <Undo2 className="w-4 h-4 mr-2" />
                          Togli da tutti i corsi ({placed.length})
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Togliere {themeLabel} da {placed.length === 1 ? '1 corso' : `${placed.length} corsi`}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Gli alunni non lo vedono più tra i compiti. I compiti tornano in archivio con i loro testi, e le consegne già fatte restano
                            da correggere in Correzioni.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction onClick={() => removeFromCourse(placed)}>Togli da tutti</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </CardContent>
              </Card>
            )}

            {theme && (
              <ul className="list-none p-0 m-0 space-y-3" aria-label={`Compiti ${theme.name} per corso`}>
                {courses.map((c) => {
                  const v = themeVariants.get(c.id);
                  const lesson = v?.lesson_id ? lessonById.get(v.lesson_id) : undefined;
                  const count = v ? submissionCounts.get(v.id) ?? 0 : 0;
                  const name = `${c.emoji} ${c.title}`;
                  return (
                    <li key={c.id} className="rounded-xl border bg-card p-3 sm:p-4" aria-label={c.title}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold flex flex-wrap items-center gap-2">
                            {name}
                            {!c.is_visible && <Badge variant="outline" className="text-xs">Non visibile</Badge>}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                            {!v ? (
                              <Badge variant="outline">Da creare</Badge>
                            ) : lesson ? (
                              <Badge>In L{lesson.lesson_number} · {lesson.title}</Badge>
                            ) : (
                              <Badge variant="secondary">In archivio</Badge>
                            )}
                            {v && <span className="truncate">{v.title}</span>}
                            {v?.due_date && <span>· Scadenza {format(new Date(v.due_date), 'dd/MM')}</span>}
                            {count > 0 && <span>· {count === 1 ? '1 consegna' : `${count} consegne`}</span>}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 shrink-0">
                          {!v ? (
                            <Button size="sm" asChild>
                              <Link to={`${editorBase}/corso/${c.id}/nuovo`}>
                                <Plus className="w-4 h-4 mr-1.5" />
                                Crea
                              </Link>
                            </Button>
                          ) : (
                            <>
                              <Button variant="ghost" size="icon" asChild title="Visualizza come gli studenti">
                                <Link to={`/admin/corsi/${c.id}/anteprima/compito/${v.id}`} aria-label={`Visualizza ${c.title}`}>
                                  <MonitorPlay className="w-4 h-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="icon" asChild title="Modifica">
                                <Link to={`${editorBase}/compito/${v.id}/modifica`} aria-label={`Modifica ${c.title}`}>
                                  <Pencil className="w-4 h-4" />
                                </Link>
                              </Button>
                              <Button size="sm" variant={lesson ? 'outline' : 'default'} onClick={() => setPlacing(v)} aria-label={`${lesson ? 'Sposta' : 'Inserisci'} ${c.title}`}>
                                {lesson ? <ArrowRightLeft className="w-4 h-4 mr-1.5" /> : <CalendarPlus className="w-4 h-4 mr-1.5" />}
                                {lesson ? 'Sposta' : 'Inserisci'}
                              </Button>
                              {lesson && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="outline" aria-label={`Togli ${c.title}`}>
                                      <Undo2 className="w-4 h-4 mr-1.5" />
                                      Togli
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Togliere il compito da {name}?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Sparisce dalla lezione {lesson.lesson_number} e gli alunni non lo vedono più. Torna in archivio, pronto per la prossima volta.
                                        {count > 0 && ` ${count === 1 ? "C'è già 1 consegna: resta" : `Ci sono già ${count} consegne: restano`} da correggere in Correzioni.`}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => removeFromCourse([v])}>Togli</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {!lesson && count === 0 && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label={`Elimina ${c.title}`} className="text-destructive hover:text-destructive">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Eliminare il compito {themeLabel} di {c.title}?</AlertDialogTitle>
                                      <AlertDialogDescription>Perdi testo, immagini e allegati di questo corso. Non si può annullare.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deleteVariant(v)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Elimina
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </main>

      <ThemeDialog
        open={themeDialog.open}
        onOpenChange={(open) => setThemeDialog((d) => ({ ...d, open }))}
        initial={themeDialog.editing ? themeDraft : null}
        onSave={saveTheme}
      />
      {placing && (
        <PlaceDialog
          open
          onOpenChange={(open) => !open && setPlacing(null)}
          courseLabel={courseLabel(placing.course_id!)}
          lessons={lessonsByCourse.get(placing.course_id!) ?? []}
          initialLessonId={placing.lesson_id ?? suggestedLessonId(placing.course_id!)}
          initialDue={dueFromDb(placing.due_date)}
          isMove={!!placing.lesson_id}
          hints={hintsByCourse.get(placing.course_id!) ?? []}
          onSave={(lessonId, due) => place(placing, lessonId, due)}
        />
      )}
      <PlaceAllDialog
        open={placeAllOpen}
        onOpenChange={setPlaceAllOpen}
        themeLabel={themeLabel}
        rows={placeAllRows}
        onSave={placeAll}
      />
    </div>
  );
}
