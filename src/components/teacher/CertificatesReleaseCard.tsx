import { useCallback, useEffect, useState } from 'react';
import { Award, Loader2, Lock, PartyPopper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CertificateCard } from '@/components/certificates/CertificateCard';
import { useToast } from '@/hooks/use-toast';
import { CERTIFICATE_HOURS, CERTIFICATE_LESSONS, certificatesUnlocked, type CourseCertificate } from '@/lib/certificate';
import { romeToday, shortDate } from '@/lib/courseProposal';
import { cn } from '@/lib/utils';

interface Props {
  groupId: string;
  maxLessons: number;
  /** Data dell'ultima lezione (la max_lessons) nel calendario del gruppo */
  lastLessonDate: string | null;
  students: { student_id: string; full_name: string; attendance: Record<number, string> }[];
  /** Admin che impersona: vede ma non sblocca */
  readOnly?: boolean;
}

/**
 * Attestati di fine corso. Restano nascosti alle famiglie finché, dal giorno
 * dell'ultima lezione, l'insegnante non li rende disponibili: ognuno riceve
 * il proprio, la famiglia viene avvisata con email e push.
 */
export function CertificatesReleaseCard({ groupId, maxLessons, lastLessonDate, students, readOnly }: Props) {
  const { toast } = useToast();
  const [certificates, setCertificates] = useState<CourseCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('course_certificates')
      .select('*')
      .eq('group_id', groupId)
      .order('student_name');
    setCertificates((data ?? []) as CourseCertificate[]);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  if (students.length === 0 || maxLessons <= 0) return null;

  const lastLessonMarked = students.some((s) => s.attendance[maxLessons]);
  const unlocked = certificatesUnlocked({ today: romeToday(), lastLessonDate, lastLessonMarked });
  const issued = new Set(certificates.map((c) => c.student_id));
  const missing = students.filter((s) => !issued.has(s.student_id));
  const releasedOn = certificates[0]?.issued_on;

  const release = async () => {
    setConfirming(false);
    setReleasing(true);
    try {
      const { data, error } = await supabase.rpc('release_group_certificates', { p_group_id: groupId });
      if (error) throw new Error(error.message);
      const created = data?.length ?? 0;
      // L'avviso non blocca: gli attestati ci sono già, al massimo manca l'email
      const { error: notifyError } = await supabase.functions.invoke('certificates-released', { body: { group_id: groupId } });
      toast({
        title: created === 1 ? 'Attestato disponibile' : `${created} attestati disponibili`,
        description: notifyError
          ? 'Gli attestati sono pronti, ma non siamo riusciti ad avvisare le famiglie: avvisale tu o riprova più tardi.'
          : 'Le famiglie li trovano nella sezione Certificazioni e ricevono un avviso.',
        variant: notifyError ? 'destructive' : undefined,
      });
      await load();
    } catch (e) {
      toast({ title: 'Attestati non sbloccati', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setReleasing(false);
    }
  };

  const shown = showAll ? certificates : certificates.slice(0, 2);

  return (
    <Card className={cn('mb-6', unlocked && missing.length > 0 && 'border-primary ring-1 ring-primary/30')} data-testid="certificates-release-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          <Award className="w-5 h-5" />
          Attestati di fine corso
          {releasedOn && <Badge variant="secondary">Disponibili dal {shortDate(releasedOn)}</Badge>}
          {!releasedOn && unlocked && <Badge>È il giorno della festa!</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {unlocked
            ? `Ogni alunno riceve il proprio attestato con ${CERTIFICATE_LESSONS} lezioni, ${CERTIFICATE_HOURS} ore e le competenze del corso. Le famiglie lo trovano nella sezione Certificazioni.`
            : lastLessonDate
              ? `Gli attestati si sbloccano il giorno della lezione ${maxLessons} (${shortDate(lastLessonDate)}): fino ad allora restano nascosti alle famiglie.`
              : `Gli attestati si sbloccano alla lezione ${maxLessons}, dopo aver segnato le presenze.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <>
            {missing.length > 0 && (
              <div className="rounded-lg border divide-y">
                {missing.map((s) => (
                  <div key={s.student_id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="font-medium">{s.full_name}</span>
                    <span className="text-muted-foreground">
                      {CERTIFICATE_LESSONS} lezioni · {CERTIFICATE_HOURS} ore
                    </span>
                  </div>
                ))}
              </div>
            )}

            {missing.length > 0 && (
              <Button
                size="lg"
                className="w-full sm:w-auto min-h-[48px]"
                onClick={() => setConfirming(true)}
                disabled={!unlocked || releasing || readOnly}
              >
                {releasing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : unlocked ? (
                  <PartyPopper className="w-4 h-4 mr-2" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                {certificates.length > 0 ? 'Sblocca per i nuovi alunni' : 'Rendi disponibili gli attestati'}
              </Button>
            )}

            {certificates.length > 0 && (
              <div className="space-y-3">
                <div className="grid gap-4 md:grid-cols-2">
                  {shown.map((c) => <CertificateCard key={c.id} certificate={c} />)}
                </div>
                {certificates.length > 2 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                    {showAll ? 'Mostra meno' : `Mostra tutti (${certificates.length})`}
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rendere disponibili gli attestati?</AlertDialogTitle>
            <AlertDialogDescription>
              {missing.length === 1 ? `${missing[0].full_name} riceverà` : `${missing.length} alunni riceveranno`} il
              proprio attestato ({CERTIFICATE_LESSONS} lezioni, {CERTIFICATE_HOURS} ore) e le famiglie un avviso via email e
              notifica. Dopo lo sblocco l'attestato non cambia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={release}>Sì, sblocca</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
