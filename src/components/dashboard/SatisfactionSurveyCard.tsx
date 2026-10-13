import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Gift, Heart, Loader2, MessageSquareHeart, Send, Share2, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { surveyQuestion, type SatisfactionSurvey, type SurveyResult } from '@/lib/satisfactionSurvey';

type Row = Pick<SatisfactionSurvey, 'id' | 'kind' | 'module_title' | 'student_id'> & {
  student: { full_name: string } | null;
};

interface Props {
  userId: string;
  /** Admin che impersona: vede il sondaggio ma non può rispondere */
  readOnly?: boolean;
}

const SCORES = Array.from({ length: 11 }, (_, i) => i);

/**
 * Sondaggio di soddisfazione nell'area riservata della famiglia: voto 0-10 e
 * commento. Dopo la risposta, a chi è soddisfatto mostra l'invito Trustpilot
 * e il link referral (arrivano anche via email).
 */
export function SatisfactionSurveyCard({ userId, readOnly }: Props) {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('sondaggio');
  const [rows, setRows] = useState<Row[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SurveyResult & { studentName: string }>>({});
  const highlightRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('satisfaction_surveys')
      .select('id, kind, module_title, student_id, student:profiles!satisfaction_surveys_student_id_fkey(full_name)')
      .eq('recipient_id', userId)
      .eq('status', 'pending')
      .order('sent_at', { ascending: true });
    setRows((data ?? []) as unknown as Row[]);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Arrivati dal link della push o dell'email: porta il sondaggio in vista
  useEffect(() => {
    if (highlight && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlight, rows]);

  const submit = async (row: Row) => {
    const score = scores[row.id];
    if (score === undefined) return;
    setBusy(row.id);
    const { data, error } = await supabase.functions.invoke('satisfaction-survey', {
      body: { action: 'respond', survey_id: row.id, score, comment: comments[row.id] ?? null },
    });
    setBusy(null);
    if (error || data?.error) {
      toast({ title: 'Non siamo riusciti a salvare la risposta', description: data?.error ?? error?.message, variant: 'destructive' });
      return;
    }
    const studentName = row.student?.full_name.split(' ')[0] ?? 'tuo figlio';
    setResults((r) => ({ ...r, [row.id]: { ...(data as SurveyResult), studentName } }));
    setRows((rs) => rs.filter((x) => x.id !== row.id));
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Link copiato!' });
    } catch {
      toast({ title: 'Copia non riuscita', description: text });
    }
  };

  const share = async (link: string, code: string | null) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'TECHLAND - Corsi di coding per ragazzi',
          text: code ? `Iscriviti a TECHLAND con il mio codice ${code}!` : 'Iscriviti a TECHLAND!',
          url: link,
        });
      } catch { /* annullato */ }
    } else {
      copy(link);
    }
  };

  const answered = Object.entries(results);
  if (rows.length === 0 && answered.length === 0) return null;

  return (
    <div className="space-y-4 mb-8" data-testid="satisfaction-survey-card">
      {answered.map(([id, r]) => (
        <Card key={id} className="border-green-300 bg-green-50 dark:bg-green-950/20" data-testid="satisfaction-survey-thanks">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-start gap-3">
              <Heart className="w-6 h-6 text-green-600 shrink-0" aria-hidden="true" />
              <div className="text-sm">
                <p className="font-semibold text-base">Grazie per la risposta!</p>
                <p className="text-muted-foreground">
                  {r.satisfied
                    ? `Siamo felici che ${r.studentName} si stia trovando bene.`
                    : r.follow_up
                      ? 'Ci dispiace che qualcosa non vada: la segreteria ti contatterà nei prossimi giorni per parlarne.'
                      : 'Terremo conto del tuo parere per migliorare.'}
                </p>
              </div>
            </div>

            {r.trustpilot_url && (
              <div className="rounded-xl border bg-background p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Star className="w-4 h-4 text-green-600" aria-hidden="true" /> Ci lasceresti una recensione su Trustpilot?
                </p>
                <p className="text-sm text-muted-foreground">Bastano due minuti e aiuta altre famiglie a conoscerci.</p>
                <Button asChild>
                  <a href={r.trustpilot_url} target="_blank" rel="noopener noreferrer">Scrivi la recensione</a>
                </Button>
              </div>
            )}

            {r.referral_link && (
              <div className="rounded-xl border bg-background p-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary" aria-hidden="true" /> Invita un'altra famiglia
                </p>
                <p className="text-sm text-muted-foreground">
                  Con il tuo link d'invito, quando una famiglia si iscrive ricevete un premio entrambi.
                </p>
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <input
                    readOnly
                    value={r.referral_link}
                    aria-label="Il tuo link d'invito"
                    className="text-xs bg-transparent flex-1 min-w-0 truncate outline-none"
                  />
                  <Button size="icon" variant="ghost" onClick={() => copy(r.referral_link!)} aria-label="Copia link">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" onClick={() => share(r.referral_link!, r.referral_code)}>
                  <Share2 className="w-4 h-4 mr-2" /> Condividi invito
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {rows.map((row) => {
        const first = row.student?.full_name.split(' ')[0] ?? 'tuo figlio';
        const score = scores[row.id];
        return (
          <Card
            key={row.id}
            ref={row.id === highlight ? highlightRef : undefined}
            className={cn('border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-tech-teal/10', row.id === highlight && 'ring-2 ring-primary')}
          >
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 shrink-0">
                  <MessageSquareHeart className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due domande, meno di un minuto</p>
                  <h2 className="text-xl font-bold">{surveyQuestion(row, first)}</h2>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium mb-2">
                  Da 0 a 10, quanto consiglieresti TECHLAND a un'altra famiglia?
                </legend>
                <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5" role="radiogroup">
                  {SCORES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={score === n}
                      aria-label={`${n} su 10`}
                      disabled={readOnly}
                      onClick={() => setScores((s) => ({ ...s, [row.id]: n }))}
                      className={cn(
                        'h-10 rounded-lg border text-sm font-semibold transition-colors disabled:opacity-60',
                        score === n
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-primary/10',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Per niente</span>
                  <span>Sicuramente</span>
                </div>
              </fieldset>

              <div className="space-y-1.5">
                <label htmlFor={`survey-comment-${row.id}`} className="text-sm font-medium">
                  Cosa vi è piaciuto, o cosa possiamo migliorare? <span className="text-muted-foreground font-normal">(facoltativo)</span>
                </label>
                <Textarea
                  id={`survey-comment-${row.id}`}
                  rows={3}
                  maxLength={2000}
                  disabled={readOnly}
                  value={comments[row.id] ?? ''}
                  onChange={(e) => setComments((c) => ({ ...c, [row.id]: e.target.value }))}
                />
              </div>

              <Button onClick={() => submit(row)} disabled={score === undefined || busy === row.id || readOnly}>
                {busy === row.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Invia
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
