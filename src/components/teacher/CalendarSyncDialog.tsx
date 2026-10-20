import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarPlus, CheckCircle2, ChevronDown, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { GoogleCalendarConnect } from "@/components/teacher/GoogleCalendarConnect";
import { fetchGoogleCalendarState, type GoogleCalendarState } from "@/lib/googleCalendarClient";
import { calendarFeedUrls } from "@/lib/teacherCalendar";
import { fetchCalendarFeed, type CalendarFeedResult } from "@/lib/teacherCalendarClient";

/**
 * Le lezioni dell'insegnante nel suo calendario personale, in due modi:
 *   - collegamento diretto dell'account Google (aggiornato in circa un minuto),
 *     quando i segreti Google sono impostati;
 *   - link .ics segreto a cui iscriversi (Google lo rilegge ogni qualche ora;
 *     funziona anche con Apple Calendar e Outlook).
 */
export function CalendarSyncDialog() {
  const [open, setOpen] = useState(false);
  const [google, setGoogle] = useState<GoogleCalendarState | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setGoogle(null);
    fetchGoogleCalendarState().then((s) => {
      if (!cancelled) setGoogle(s);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs">
          <CalendarPlus className="w-3.5 h-3.5 mr-1" />
          Google Calendar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 pr-12">
            <CalendarPlus className="w-5 h-5 text-primary" />
            Le lezioni nel tuo Google Calendar
          </DialogTitle>
          <DialogDescription>
            Le tue lezioni compaiono in un calendario a parte, «TECHLAND · Lezioni», e si aggiornano da sole
            quando cambiano date, orari, gruppi o link dell'aula.
          </DialogDescription>
        </DialogHeader>

        {!google && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Un attimo…
          </div>
        )}

        {google && !google.configured && <IcalFeedSection standalone />}

        {google?.configured && (
          <div className="space-y-4">
            <GoogleCalendarConnect state={google} onChange={setGoogle} />
            <Collapsible>
              <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium py-1">
                Altri calendari (Apple, Outlook) o link da copiare
                <ChevronDown className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-3">
                {google.connection && (
                  <p className="text-xs text-muted-foreground">
                    Hai già collegato Google qui sopra: in Google Calendar non serve anche il link, vedresti ogni
                    lezione due volte.
                  </p>
                )}
                <IcalFeedSection />
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Link .ics segreto (teacher-calendar-feed): lo crea al primo uso.
 * `standalone`: è l'unico modo disponibile (collegamento Google non attivo).
 */
function IcalFeedSection({ standalone = false }: { standalone?: boolean }) {
  const [result, setResult] = useState<CalendarFeedResult | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    fetchCalendarFeed().then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const feed = result?.status === "ok" ? result.feed : null;
  const urls = feed ? calendarFeedUrls(import.meta.env.VITE_SUPABASE_URL, feed.token) : null;

  const copyLink = async () => {
    if (!urls) return;
    try {
      await navigator.clipboard.writeText(urls.https);
      toast.success("Link copiato");
    } catch {
      toast.error("Non riesco a copiarlo: selezionalo e copialo a mano");
    }
  };

  const rotate = async () => {
    setRotating(true);
    const r = await fetchCalendarFeed(true);
    setRotating(false);
    setConfirmRotate(false);
    if (r.status === "ok") {
      setResult(r);
      toast.success("Nuovo link creato: aggiungi di nuovo il calendario");
    } else {
      toast.error("Non riesco a rigenerare il link, riprova");
    }
  };

  if (!result) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Preparo il tuo link…
      </div>
    );
  }

  if (result.status === "unavailable") {
    return (
      <p className="text-sm text-muted-foreground py-4">
        La sincronizzazione con Google Calendar sarà disponibile a breve.
      </p>
    );
  }

  if (result.status === "error" || !feed || !urls) {
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-destructive">
          Non riesco a preparare il link{result.status === "error" ? `: ${result.message}` : ""}
        </p>
        <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
          Riprova
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Button asChild className="w-full" variant={standalone ? "default" : "outline"}>
          <a href={urls.google} target="_blank" rel="noopener noreferrer">
            {standalone ? "Aggiungi a Google Calendar" : "Aggiungi a Google Calendar con il link"}
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          Si apre Google Calendar: conferma con «Aggiungi». Fallo dal computer: poi le lezioni compaiono anche
          nell'app sul telefono.
        </p>
        {feed.last_fetched_at ? (
          <p className="text-xs flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Collegato: letto da un calendario{" "}
            {formatDistanceToNow(new Date(feed.last_fetched_at), { locale: it, addSuffix: true })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Non ancora collegato a nessun calendario.</p>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Oppure copia il link</p>
        <div className="flex gap-2">
          <Input
            readOnly
            value={urls.https}
            aria-label="Link del calendario"
            className="text-xs font-mono"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="Copia il link">
            <Copy className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          In Google Calendar: Altri calendari → + → Da URL. Va bene anche per Outlook, oppure{" "}
          <a href={urls.webcal} className="underline underline-offset-2">
            apri nell'app Calendario
          </a>{" "}
          (Mac, iPhone).
        </p>
      </div>

      <div className="rounded-md bg-muted/60 p-3 space-y-2 text-xs text-muted-foreground">
        <p>
          Con il link Google rilegge il calendario ogni qualche ora, a volte fino a un giorno: per i cambi
          dell'ultimo minuto fa fede la dashboard.
        </p>
        <p>
          Il link è personale: chi lo ha vede le tue lezioni e i link delle aule. Se l'hai condiviso per errore,
          rigeneralo e aggiungi di nuovo il calendario.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 -ml-2 text-xs"
          onClick={() => setConfirmRotate(true)}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Rigenera link
        </Button>
      </div>

      <AlertDialog open={confirmRotate} onOpenChange={setConfirmRotate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rigenerare il link?</AlertDialogTitle>
            <AlertDialogDescription>
              Il link attuale smette di funzionare: il calendario «TECHLAND · Lezioni» non si aggiornerà più
              finché non lo aggiungi di nuovo con il nuovo link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rotating}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={rotating}
              onClick={(e) => {
                e.preventDefault();
                rotate();
              }}
            >
              {rotating && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Rigenera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
