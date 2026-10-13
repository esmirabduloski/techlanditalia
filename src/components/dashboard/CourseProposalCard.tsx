import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, GraduationCap, Loader2, MessageCircle, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { discountStillValid, formatEuro, romeToday, shortDate, type CourseProposal } from '@/lib/courseProposal';

type Row = CourseProposal & {
  student: { full_name: string } | null;
  course: { title: string; emoji: string } | null;
  group: { teacher_id: string | null; course: { title: string } | null } | null;
};

interface Props {
  userId: string;
  /** Admin che impersona: vede la proposta ma non può rispondere */
  readOnly?: boolean;
}

/** Le risposte restano visibili qualche giorno come conferma, poi spariscono. */
const SHOW_ANSWERED_DAYS = 14;

/**
 * Proposta del corso successivo in evidenza nell'area riservata della
 * famiglia: corso consigliato, motivo dell'insegnante, sconto per chi
 * conferma entro la scadenza e i due pulsanti di risposta.
 */
export function CourseProposalCard({ userId, readOnly }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [teachers, setTeachers] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [talking, setTalking] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    const since = new Date(Date.now() - SHOW_ANSWERED_DAYS * 86_400_000).toISOString();
    const { data } = await supabase
      .from('course_proposals')
      .select(
        '*, student:profiles!course_proposals_student_id_fkey(full_name), ' +
        'course:courses!course_proposals_proposed_course_id_fkey(title, emoji), ' +
        'group:student_groups!course_proposals_group_id_fkey(teacher_id, course:courses(title))',
      )
      .or(`status.eq.sent,responded_at.gte.${since}`)
      .in('status', ['sent', 'accepted', 'declined'])
      .order('sent_at', { ascending: false });
    // RLS: il genitore vede le proposte dei figli, l'alunno le proprie. Un
    // alunno con un genitore collegato non le vede qui: risponde il genitore.
    const { data: me } = await supabase.from('profiles').select('role, parent_id').eq('id', userId).maybeSingle();
    const list = ((data ?? []) as unknown as Row[]).filter((r) => me?.role === 'parent' || (!me?.parent_id && r.student_id === userId));
    setRows(list);
    const teacherIds = [...new Set(list.map((r) => r.group?.teacher_id).filter((x): x is string => !!x))];
    if (teacherIds.length) {
      const { data: t } = await supabase.from('profiles').select('id, full_name').in('id', teacherIds);
      setTeachers(new Map((t ?? []).map((p) => [p.id, p.full_name.split(' ')[0]])));
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (p: Row, accept: boolean) => {
    setBusy(p.id);
    const { data, error } = await supabase.functions.invoke('course-proposal', {
      body: { action: 'respond', proposal_id: p.id, accept, note: accept ? null : note },
    });
    setBusy(null);
    if (error || data?.error) {
      toast({ title: 'Non siamo riusciti a registrare la risposta', description: data?.error ?? error?.message, variant: 'destructive' });
      return;
    }
    setTalking(null);
    setNote('');
    toast({
      title: accept ? 'Fantastico, grazie!' : 'Grazie, ti richiamiamo noi',
      description: accept
        ? 'Ti contattiamo a breve per orario e iscrizione.'
        : 'La segreteria ti contatterà nei prossimi giorni.',
    });
    load();
  };

  if (rows.length === 0) return null;
  const today = romeToday();

  return (
    <div className="space-y-4 mb-8" data-testid="course-proposal-card">
      {rows.map((p) => {
        const first = p.student?.full_name.split(' ')[0] ?? 'tuo figlio';
        const teacher = (p.group?.teacher_id && teachers.get(p.group.teacher_id)) || "L'insegnante";
        const courseTitle = p.course ? `${p.course.emoji} ${p.course.title}` : 'il prossimo corso';
        const discountValid = discountStillValid({ today, expiresOn: p.offer_expires_on, discountCents: p.discount_cents });

        if (p.status !== 'sent') {
          return (
            <Card key={p.id} className="border-green-300 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-6 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                <div className="text-sm">
                  {p.status === 'accepted' ? (
                    <>
                      <p className="font-semibold">{first} continua con {courseTitle}!</p>
                      <p className="text-muted-foreground">
                        {p.discount_applies ? `Lo sconto di ${formatEuro(p.discount_cents)} è tuo. ` : ''}
                        Ti contattiamo a breve per orario e iscrizione.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold">Abbiamo ricevuto la tua risposta</p>
                      <p className="text-muted-foreground">La segreteria ti contatterà per parlarne insieme.</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        }

        return (
          <Card key={p.id} className="border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-tech-teal/10 overflow-hidden">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 shrink-0"><GraduationCap className="w-6 h-6 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {first} sta finendo {p.group?.course?.title ?? 'il corso'}
                  </p>
                  <h2 className="text-xl font-bold">Il prossimo passo: {courseTitle}</h2>
                </div>
              </div>

              <blockquote className="border-l-4 border-primary pl-4 italic text-foreground/90">
                "{p.teacher_reason}"
                <footer className="not-italic text-sm text-muted-foreground mt-1">— {teacher}, insegnante di {first}</footer>
              </blockquote>

              {discountValid ? (
                <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-green-500 bg-green-50 dark:bg-green-950/30 p-3">
                  <Sparkles className="w-5 h-5 text-green-600 shrink-0" />
                  <p className="text-sm">
                    <span className="font-bold text-green-700 dark:text-green-400 text-base">-{formatEuro(p.discount_cents)}</span>{' '}
                    se confermi entro il <strong>{shortDate(p.offer_expires_on!)}</strong>: {first} tiene il suo posto senza pause.
                  </p>
                </div>
              ) : p.offer_expires_on && (
                <p className="text-sm text-muted-foreground">
                  {p.discount_cents > 0 ? `Lo sconto era valido fino al ${shortDate(p.offer_expires_on)}. ` : ''}
                  Puoi comunque confermare il posto.
                </p>
              )}

              {talking === p.id ? (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    maxLength={1000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Facoltativo: dubbi su orari, costi, altro corso…"
                    aria-label="Nota per la segreteria"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => respond(p, false)} disabled={busy === p.id || readOnly}>
                      {busy === p.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Chiedi di essere ricontattato
                    </Button>
                    <Button variant="ghost" onClick={() => setTalking(null)}>Annulla</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button size="lg" onClick={() => respond(p, true)} disabled={busy === p.id || readOnly}>
                    {busy === p.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Sì, continuiamo
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => setTalking(p.id)} disabled={readOnly}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Vorrei parlarne
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
