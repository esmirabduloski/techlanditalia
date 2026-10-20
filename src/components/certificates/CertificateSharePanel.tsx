import { useEffect, useState } from 'react';
import { Copy, ExternalLink, Globe, Instagram, Linkedin, Loader2, Lock } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { certificateClient } from '@/lib/certificateClient';
import {
  certificateUrl,
  isCertificatePublic,
  linkedInAddToProfileUrl,
  type CourseCertificate,
} from '@/lib/certificate';

export interface CertificateSharing {
  viewer: 'parent' | 'student';
  /** Il genitore sempre; lo studente solo con 14 anni certi (stessa regola del database) */
  canPublish: boolean;
  /** Nome dell'alunno nei testi per il genitore */
  studentFirstName: string;
  onChange: (certificate: CourseCertificate) => void;
}

interface Props extends CertificateSharing {
  certificate: CourseCertificate;
}

/** Il telefono sa condividere un'immagine (Instagram, WhatsApp…)? */
function canShareFiles(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [new File([''], 'attestato.png', { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/**
 * Link pubblico dell'attestato (0064_certificate_sharing). Di base è privato:
 * chi inquadra il QR vede solo le iniziali. Da pubblico si aggiunge a
 * LinkedIn, si condivide l'immagine su Instagram o si copia il link.
 */
export function CertificateSharePanel({ certificate: c, viewer, canPublish, studentFirstName, onChange }: Props) {
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharingImage, setSharingImage] = useState(false);
  const [shareFile, setShareFile] = useState<File | null>(null);
  const isPublic = isCertificatePublic(c);
  const url = certificateUrl(c.code);

  // Sul telefono la condivisione deve partire subito dopo il tocco: l'immagine
  // si prepara prima. Sul computer si crea al clic e si scarica.
  useEffect(() => {
    if (!isPublic || !canShareFiles()) return;
    let cancelled = false;
    import('@/lib/certificatePdf')
      .then((m) => m.certificateShareFile(c))
      .then((f) => !cancelled && setShareFile(f))
      .catch(() => {
        // Si riprova al clic
      });
    return () => {
      cancelled = true;
    };
    // L'attestato non cambia dopo lo sblocco: bastano id e stato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id, isPublic]);

  const setPublic = async (value: boolean) => {
    setSaving(true);
    const { data, error } = await certificateClient.rpc('set_certificate_public', {
      p_certificate_id: c.id,
      p_public: value,
    });
    setSaving(false);
    setConfirming(false);
    if (error || !data) {
      toast({
        title: 'Non siamo riusciti a cambiare il link',
        description: error?.message ?? 'Riprova tra qualche istante.',
        variant: 'destructive',
      });
      return;
    }
    onChange(data as CourseCertificate);
    toast({
      title: value ? 'Link pubblico attivo' : 'Attestato di nuovo privato',
      description: value
        ? 'Ora puoi aggiungerlo a LinkedIn o condividerlo su Instagram.'
        : 'Chi inquadra il QR code vede solo le iniziali.',
    });
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copiato', description: url });
    } catch {
      toast({ title: 'Copia il link', description: url });
    }
  };

  const shareImage = async () => {
    setSharingImage(true);
    try {
      const m = await import('@/lib/certificatePdf');
      const file = shareFile ?? (await m.certificateShareFile(c));
      const result = await m.shareCertificateImage(file, c);
      if (result === 'downloaded') {
        toast({
          title: 'Immagine scaricata',
          description: 'Pubblicala su Instagram (post o storia) o allegala a un post su LinkedIn.',
        });
      }
    } catch (e) {
      toast({
        title: "Non siamo riusciti a creare l'immagine",
        description: e instanceof Error ? e.message : 'Riprova tra qualche istante.',
        variant: 'destructive',
      });
    } finally {
      setSharingImage(false);
    }
  };

  const switchId = `certificate-public-${c.id}`;
  const confirmTitle = viewer === 'parent'
    ? `Rendere pubblico l'attestato di ${studentFirstName}?`
    : 'Rendere pubblico il tuo attestato?';
  const confirmText = `Chi apre il link o inquadra il QR code vedrà ${
    viewer === 'parent' ? `nome e cognome di ${studentFirstName}` : 'il tuo nome e cognome'
  }, il corso, le competenze e l'insegnante. Così puoi aggiungerlo a LinkedIn o condividerlo su Instagram. Puoi renderlo di nuovo privato quando vuoi.`;

  if (!isPublic && !canPublish) {
    return (
      <p className="border-t pt-3 text-sm text-muted-foreground flex gap-2" data-testid="certificate-share">
        <Lock className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
        Per condividerlo online serve il link pubblico: chiedi a un genitore di attivarlo dalla sua area.
      </p>
    );
  }

  return (
    <div className="border-t pt-3 space-y-3" data-testid="certificate-share">
      <div className="flex items-start gap-3">
        {isPublic ? (
          <Globe className="w-5 h-5 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        ) : (
          <Lock className="w-5 h-5 mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        )}
        <div className="flex-1 min-w-0">
          <label htmlFor={switchId} className="font-medium text-sm cursor-pointer">
            {isPublic ? 'Link pubblico attivo' : 'Condividi su LinkedIn o Instagram'}
          </label>
          <p className="text-xs text-muted-foreground">
            {isPublic
              ? 'Chi apre il link o inquadra il QR code vede nome, corso e competenze.'
              : "Ora chi inquadra il QR code vede solo le iniziali. Attiva il link pubblico per mostrare l'attestato completo."}
          </p>
        </div>
        <Switch
          id={switchId}
          checked={isPublic}
          disabled={saving}
          onCheckedChange={(on) => (on ? setConfirming(true) : setPublic(false))}
        />
      </div>

      {isPublic && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="min-h-[44px] justify-start">
            <a href={linkedInAddToProfileUrl(c)} target="_blank" rel="noopener noreferrer">
              <Linkedin className="w-4 h-4 mr-2 text-[#0a66c2]" aria-hidden="true" />
              Aggiungi a LinkedIn
            </a>
          </Button>
          <Button variant="outline" className="min-h-[44px] justify-start" onClick={shareImage} disabled={sharingImage}>
            {sharingImage ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
            ) : (
              <Instagram className="w-4 h-4 mr-2 text-[#d62976]" aria-hidden="true" />
            )}
            Immagine per Instagram
          </Button>
          <Button variant="outline" className="min-h-[44px] justify-start" onClick={copyLink}>
            <Copy className="w-4 h-4 mr-2" aria-hidden="true" />
            Copia link
          </Button>
          <Button asChild variant="ghost" className="min-h-[44px] justify-start">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
              Apri la pagina pubblica
            </a>
          </Button>
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={(open) => !saving && setConfirming(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{confirmText}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void setPublic(true);
              }}
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Sì, rendi pubblico
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
