import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { finishGoogleConnect } from "@/lib/googleCalendarClient";

/**
 * Pagina su cui Google rimanda l'insegnante dopo l'autorizzazione
 * (redirect URI https://techlanditalia.it/insegnante/google-calendar): passa
 * codice e state all'edge function google-calendar, che crea il calendario e
 * copia le lezioni, poi torna alla dashboard.
 */
export default function TeacherGoogleCalendarCallback() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const googleError = params.get("error");
    // Il codice si usa una volta: non resta nella cronologia
    window.history.replaceState(window.history.state, "", window.location.pathname);

    if (googleError === "access_denied") {
      setProblem("Hai annullato il collegamento su Google: il tuo calendario non è stato toccato.");
      return;
    }
    if (googleError || !code || !state) {
      setProblem("Google non ha completato il collegamento. Riprova dalla dashboard.");
      return;
    }

    finishGoogleConnect(code, state).then((r) => {
      if (!r.ok) {
        setProblem(r.error);
        return;
      }
      const email = r.data.connection?.google_email;
      toast.success(email ? `Google Calendar collegato a ${email}` : "Google Calendar collegato");
      if (!r.data.sync.ok) toast.error(`Le lezioni arriveranno a breve: ${r.data.sync.error}`);
      navigate("/insegnante", { replace: true });
    });
  }, [isLoading, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarPlus className="w-5 h-5 text-primary" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {problem ? (
            <>
              <p className="text-sm flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                {problem}
              </p>
              <Button asChild>
                <Link to="/insegnante">Torna alla dashboard</Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Collego il tuo account e copio le lezioni nel calendario…
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
