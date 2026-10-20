import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Zap } from "lucide-react";
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
import {
  disconnectGoogle,
  type GoogleCalendarState,
  startGoogleConnect,
  syncGoogleNow,
} from "@/lib/googleCalendarClient";

interface Props {
  state: GoogleCalendarState;
  onChange: (state: GoogleCalendarState) => void;
}

const ago = (iso: string) => formatDistanceToNow(new Date(iso), { locale: it, addSuffix: true });

/**
 * Collegamento diretto dell'account Google: TECHLAND crea nel calendario
 * dell'insegnante «TECHLAND · Lezioni» e lo aggiorna circa un minuto dopo ogni
 * cambio (edge function google-calendar / google-calendar-sync).
 */
export function GoogleCalendarConnect({ state, onChange }: Props) {
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const connection = state.connection;

  const connect = async () => {
    setBusy("connect");
    const r = await startGoogleConnect();
    if (!r.ok) {
      setBusy(null);
      toast.error(r.error);
      return;
    }
    // Si va da Google; si torna su /insegnante/google-calendar
    window.location.assign(r.data.url);
  };

  const syncNow = async () => {
    setBusy("sync");
    const r = await syncGoogleNow();
    setBusy(null);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    onChange({ configured: true, connection: r.data.connection });
    if (r.data.sync.ok) toast.success("Google Calendar aggiornato");
    else toast.error(r.data.sync.error);
  };

  const disconnect = async () => {
    setBusy("disconnect");
    const r = await disconnectGoogle();
    setBusy(null);
    setConfirmDisconnect(false);
    if (!r.ok) {
      toast.error(r.error);
      return;
    }
    onChange({ configured: true, connection: null });
    toast.success("Google Calendar scollegato");
  };

  if (!connection) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Collega il tuo account Google
        </p>
        <p className="text-xs text-muted-foreground">
          Accedi una volta con Google: le lezioni compaiono nel calendario «TECHLAND · Lezioni» e ogni cambio di
          data, orario o link dell'aula arriva in circa un minuto. TECHLAND gestisce solo quel calendario: non vede
          e non modifica gli altri.
        </p>
        <Button className="w-full" onClick={connect} disabled={busy !== null}>
          {busy === "connect" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Collega Google Calendar
        </Button>
      </div>
    );
  }

  const stopped = connection.status !== "active";

  return (
    <div className="rounded-lg border p-4 space-y-3">
      {stopped ? (
        <p className="text-sm flex items-start gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {connection.last_error || "Il collegamento con Google si è interrotto: collega di nuovo il tuo account."}
        </p>
      ) : (
        <div className="space-y-1">
          <p className="text-sm font-medium flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            Collegato{connection.google_email ? ` a ${connection.google_email}` : ""}
          </p>
          <p className="text-xs text-muted-foreground">
            {connection.pending
              ? "Sto aggiornando il calendario con le ultime modifiche…"
              : connection.last_synced_at
              ? `Aggiornato ${ago(connection.last_synced_at)}. Le modifiche arrivano in circa un minuto.`
              : "Le modifiche arrivano in circa un minuto."}
          </p>
          {connection.last_error && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Ultimo tentativo non riuscito, riprovo da solo tra poco.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {stopped ? (
          <Button size="sm" onClick={connect} disabled={busy !== null}>
            {busy === "connect" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Collega di nuovo
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={syncNow} disabled={busy !== null}>
            {busy === "sync" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Aggiorna ora
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setConfirmDisconnect(true)} disabled={busy !== null}>
          Scollega
        </Button>
      </div>

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scollegare Google Calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              Il calendario «TECHLAND · Lezioni» viene tolto dal tuo Google Calendar e TECHLAND non potrà più
              modificarlo. Puoi ricollegarlo quando vuoi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "disconnect"}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "disconnect"}
              onClick={(e) => {
                e.preventDefault();
                disconnect();
              }}
            >
              {busy === "disconnect" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Scollega
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
