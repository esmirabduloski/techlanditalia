import { useEffect, useState } from 'react';
import { Award, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { CERTIFICATE_HOURS, CERTIFICATE_LESSONS, formatHours, type CertificateData } from '@/lib/certificate';
import { shortDate } from '@/lib/courseProposal';
import { cn } from '@/lib/utils';

interface Props {
  certificate: CertificateData & { id: string; course_emoji?: string | null };
  className?: string;
}

/**
 * Attestato di fine corso: anteprima (lo stesso disegno del PDF) e pulsante
 * per scaricarlo. Modello, font e jsPDF si caricano solo qui.
 */
export function CertificateCard({ certificate: c, className }: Props) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    import('@/lib/certificatePdf')
      .then((m) => m.certificatePreviewUrl(c))
      .then((u) => {
        if (cancelled) URL.revokeObjectURL(u);
        else setPreview((url = u));
      })
      .catch(() => {
        // Senza anteprima resta il riquadro con il pulsante
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // L'attestato non cambia dopo lo sblocco: basta l'id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id]);

  const download = async () => {
    setBusy(true);
    try {
      const { downloadCertificatePdf } = await import('@/lib/certificatePdf');
      await downloadCertificatePdf(c);
    } catch (e) {
      toast({
        title: "Non siamo riusciti a creare il PDF",
        description: e instanceof Error ? e.message : 'Riprova tra qualche istante.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', className)} data-testid="certificate-card">
      <div className="aspect-[842/595] bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950/30 dark:to-cyan-950/30">
        {preview ? (
          <img src={preview} alt={`Attestato di ${c.student_name}: ${c.course_title}`} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Award className="w-12 h-12 text-primary/40" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="font-semibold">
            {c.course_emoji ? `${c.course_emoji} ` : ''}
            {c.course_title}
          </p>
          <p className="text-sm text-muted-foreground">
            {CERTIFICATE_LESSONS} lezioni · {formatHours(CERTIFICATE_HOURS)} ore di coding · {shortDate(c.issued_on)}
          </p>
        </div>
        <Button onClick={download} disabled={busy} className="w-full sm:w-auto min-h-[48px]">
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          Scarica PDF
        </Button>
      </div>
    </div>
  );
}
