import { useCallback, useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CertificateCard } from '@/components/certificates/CertificateCard';
import { CelebrationOverlay } from '@/components/gamification/CelebrationOverlay';
import type { CourseCertificate } from '@/lib/certificate';

interface Props {
  userId: string;
}

const SEEN_KEY = 'techland:certificates-seen';

function seenIds(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function markSeen(ids: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...seenIds(), ...ids])]));
  } catch {
    // Senza localStorage i coriandoli ripartono alla prossima visita: pazienza
  }
}

/**
 * Certificazioni dell'alunno: compaiono solo dopo che l'insegnante ha
 * sbloccato gli attestati, il giorno della festa di fine corso. La prima
 * volta partono i coriandoli.
 */
export function StudentCertificatesCard({ userId }: Props) {
  const [certificates, setCertificates] = useState<CourseCertificate[]>([]);
  const [celebrate, setCelebrate] = useState<CourseCertificate | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('course_certificates')
        .select('*')
        .eq('student_id', userId)
        .order('issued_on', { ascending: false });
      const list = (data ?? []) as CourseCertificate[];
      setCertificates(list);
      const seen = seenIds();
      const fresh = list.find((c) => !seen.includes(c.id));
      if (fresh) setCelebrate(fresh);
    })();
  }, [userId]);

  const close = useCallback(() => {
    markSeen(certificates.map((c) => c.id));
    setCelebrate(null);
  }, [certificates]);

  if (certificates.length === 0) return null;

  return (
    <>
      <Card className="mb-8 border-2 border-primary/40 bg-gradient-to-br from-primary/5 to-tech-teal/10" id="certificazioni" data-testid="student-certificates">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2"><Award className="w-5 h-5 text-primary" /></div>
            Certificazioni
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Hai completato il corso: ecco il tuo attestato con tutto quello che hai imparato. Scaricalo e fallo vedere a casa!
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {certificates.map((c) => <CertificateCard key={c.id} certificate={c} />)}
          </div>
        </CardContent>
      </Card>
      <CelebrationOverlay
        type="certificate"
        title={celebrate?.course_title ?? ''}
        subtitle="Il tuo attestato è pronto"
        emoji={celebrate?.course_emoji ?? '🎓'}
        isVisible={!!celebrate}
        onClose={close}
      />
    </>
  );
}
