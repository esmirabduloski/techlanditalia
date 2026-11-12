import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { EXTRA_LINK_LABEL_MAX, saveExtraMeetingLink, validateExtraLink, type ExtraMeetingLink } from '@/lib/extraMeetingLinks';
import { Link2, Loader2, Save, Video } from 'lucide-react';

interface Props {
  studentId: string;
  studentName: string;
  link: ExtraMeetingLink | undefined;
  onSaved: () => void;
}

/** Admin → Utenti: il secondo link per entrare a lezione di un singolo studente. */
export function ExtraMeetingLinkButton({ studentId, studentName, link, onSaved }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(link?.label ?? '');
    setUrl(link?.url ?? '');
  }, [open, link]);

  const invalid = validateExtraLink(label, url);

  const save = async (nextUrl: string) => {
    setIsSaving(true);
    const error = await saveExtraMeetingLink(studentId, label, nextUrl);
    setIsSaving(false);
    if (error) {
      toast({ title: 'Errore', description: error, variant: 'destructive' });
      return;
    }
    toast({
      title: nextUrl.trim() ? 'Secondo link salvato' : 'Secondo link tolto',
      description: nextUrl.trim()
        ? `${studentName} vede il pulsante "Entra a lezione · ${label.trim()}".`
        : `${studentName} non vede più il pulsante in più.`,
    });
    setOpen(false);
    onSaved();
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={link ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setOpen(true)}
              aria-label={`Secondo link lezione di ${studentName}`}
            >
              <Link2 className="w-4 h-4" />
              {link && <span className="ml-1">2° link</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{link ? `Secondo link: ${link.label}` : 'Aggiungi un secondo link lezione'}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Secondo link lezione - {studentName}</DialogTitle>
            <DialogDescription>
              Per i casi speciali, es. se lo studente segue anche la lezione di un altro gruppo.
              Lo studente e i suoi genitori vedono un pulsante "Entra a lezione" in più, sempre,
              a prescindere dal calendario. Lascia il link vuoto per toglierlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="extra-link-label">Testo del pulsante</Label>
              <Input
                id="extra-link-label"
                value={label}
                maxLength={EXTRA_LINK_LABEL_MAX}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="LINK PER GRUPPO DEL MARTEDÌ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra-link-url">Link della lezione</Label>
              <Input
                id="extra-link-url"
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://meet.google.com/..."
              />
            </div>
            {url.trim() && label.trim() && !invalid && (
              <div className="rounded-lg border border-dashed p-3">
                <p className="text-xs text-muted-foreground mb-2">Anteprima per lo studente</p>
                <span className="inline-flex items-center gap-2 rounded-xl border-2 border-primary px-4 py-2 font-bold text-primary">
                  <Video className="w-4 h-4" />
                  <span className="text-left">
                    Entra a lezione
                    <span className="block text-xs font-semibold opacity-90">{label.trim()}</span>
                  </span>
                </span>
              </div>
            )}
            {invalid && url.trim() && <p className="text-sm text-destructive" role="alert">{invalid}</p>}
          </div>
          <DialogFooter className="flex-row flex-wrap justify-end gap-2">
            {link && (
              <Button variant="ghost" className="text-destructive mr-auto" onClick={() => save('')} disabled={isSaving}>
                Togli il link
              </Button>
            )}
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>Annulla</Button>
            <Button onClick={() => save(url)} disabled={isSaving || !!invalid || (!url.trim() && !link)}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
