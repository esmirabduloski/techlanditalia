import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Loader2, CheckCircle2, Clock, XCircle, Trash2 } from "lucide-react";

type RequestType = "account_and_children" | "account_only" | "data_only";

interface DeletionRequest {
  id: string;
  request_type: string;
  reason: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  processed_at: string | null;
  children: unknown;
}

const STATUS_META: Record<string, { label: string; icon: typeof Clock; variant: "secondary" | "default" | "destructive" | "outline" }> = {
  pending: { label: "In attesa di presa in carico", icon: Clock, variant: "secondary" },
  in_review: { label: "In lavorazione", icon: Loader2, variant: "default" },
  completed: { label: "Completata", icon: CheckCircle2, variant: "outline" },
  rejected: { label: "Respinta", icon: XCircle, variant: "destructive" },
};

const TYPE_LABEL: Record<string, string> = {
  account_and_children: "Cancellazione del mio account e degli account dei miei figli",
  account_only: "Cancellazione solo del mio account genitore",
  data_only: "Cancellazione dei dati personali (senza chiusura account)",
};

export function DataDeletionRequestCard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [children, setChildren] = useState<{ id: string; full_name: string; email: string | null }[]>([]);
  const [profile, setProfile] = useState<{ id: string; full_name: string; email: string | null } | null>(null);
  const [requestType, setRequestType] = useState<RequestType>("account_and_children");
  const [reason, setReason] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const [{ data: prof }, { data: kids }, { data: reqs }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("id", user.id).maybeSingle(),
      supabase.from("profiles").select("id, full_name, email").eq("parent_id", user.id),
      supabase
        .from("data_deletion_requests")
        .select("id, request_type, reason, status, admin_notes, created_at, processed_at, children")
        .order("created_at", { ascending: false }),
    ]);
    setProfile(prof ?? null);
    setChildren(kids ?? []);
    setRequests((reqs ?? []) as DeletionRequest[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openRequest = requests.find((r) => r.status === "pending" || r.status === "in_review");

  const submit = async () => {
    setError(null);
    if (!profile) return;
    const trimmedReason = reason.trim().slice(0, 1000);
    setSubmitting(true);
    const { error: insertError } = await supabase.from("data_deletion_requests").insert({
      requester_id: profile.id,
      requester_email: profile.email ?? "",
      requester_name: profile.full_name,
      request_type: requestType,
      reason: trimmedReason || null,
      confirm_understood: true,
      children:
        requestType === "account_and_children"
          ? children.map((c) => ({ id: c.id, full_name: c.full_name, email: c.email }))
          : [],
    });
    setSubmitting(false);
    setConfirmOpen(false);

    if (insertError) {
      setError(
        insertError.message.includes("duplicate") || insertError.code === "23505"
          ? "Hai già una richiesta di cancellazione aperta."
          : `Invio non riuscito: ${insertError.message}`,
      );
      return;
    }

    setReason("");
    setUnderstood(false);
    toast({
      title: "Richiesta inviata",
      description: "Abbiamo registrato la tua richiesta di cancellazione. Riceverai riscontro dopo la verifica manuale.",
    });
    await load();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-destructive" aria-hidden="true" />
          Cancellazione account e dati personali
        </CardTitle>
        <CardDescription>
          Puoi richiedere la cancellazione del tuo account e dei dati personali. La richiesta viene verificata e
          gestita manualmente dal nostro team: nessun dato viene eliminato automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {openRequest ? (
          <div className="space-y-3">
            <Alert>
              <AlertTitle className="flex items-center gap-2">
                Richiesta ricevuta
                <Badge variant={STATUS_META[openRequest.status]?.variant ?? "secondary"}>
                  {STATUS_META[openRequest.status]?.label ?? openRequest.status}
                </Badge>
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-1 text-sm">
                <p>Tipo: {TYPE_LABEL[openRequest.request_type] ?? openRequest.request_type}</p>
                <p>Inviata il: {new Date(openRequest.created_at).toLocaleString("it-IT")}</p>
                <p>ID richiesta: <span className="font-mono text-xs">{openRequest.id.slice(0, 8)}</span></p>
                {openRequest.admin_notes && <p>Nota dal team: {openRequest.admin_notes}</p>}
              </AlertDescription>
            </Alert>
            <p className="text-xs text-muted-foreground">
              Per modificare o annullare la richiesta scrivi a privacy@techlanditalia.it indicando l'ID richiesta.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              <Label>Cosa vuoi richiedere?</Label>
              <RadioGroup value={requestType} onValueChange={(v) => setRequestType(v as RequestType)} className="space-y-2">
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="account_and_children" id="ddr-both" className="mt-1" />
                  <Label htmlFor="ddr-both" className="font-normal leading-snug cursor-pointer">
                    Il mio account e gli account dei miei figli
                    {children.length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        Alunni coinvolti: {children.map((c) => c.full_name).join(", ")}
                      </span>
                    )}
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="account_only" id="ddr-account" className="mt-1" />
                  <Label htmlFor="ddr-account" className="font-normal leading-snug cursor-pointer">
                    Solo il mio account genitore
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="data_only" id="ddr-data" className="mt-1" />
                  <Label htmlFor="ddr-data" className="font-normal leading-snug cursor-pointer">
                    Solo i miei dati personali (mantenendo l'account attivo)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ddr-reason">Motivo (opzionale, max 1000 caratteri)</Label>
              <Textarea
                id="ddr-reason"
                value={reason}
                maxLength={1000}
                rows={3}
                placeholder="Puoi indicarci il motivo della richiesta"
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="ddr-understood"
                checked={understood}
                onCheckedChange={(v) => setUnderstood(v === true)}
                className="mt-1"
              />
              <Label htmlFor="ddr-understood" className="font-normal leading-snug cursor-pointer">
                Ho capito che la cancellazione è definitiva e comporta la perdita di progressi, compiti, badge e
                cronologia delle lezioni.
              </Label>
            </div>

            <Button
              variant="destructive"
              disabled={!understood || submitting}
              onClick={() => setConfirmOpen(true)}
              className="w-full sm:w-auto"
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Invia richiesta di cancellazione
            </Button>
          </>
        )}

        {requests.filter((r) => r.status === "completed" || r.status === "rejected").length > 0 && (
          <div className="pt-4 border-t border-border/60 space-y-2">
            <p className="text-sm font-medium">Storico richieste</p>
            {requests
              .filter((r) => r.status === "completed" || r.status === "rejected")
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("it-IT")} — {TYPE_LABEL[r.request_type] ?? r.request_type}
                  </span>
                  <Badge variant={STATUS_META[r.status]?.variant ?? "secondary"}>
                    {STATUS_META[r.status]?.label ?? r.status}
                  </Badge>
                </div>
              ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confermi l'invio della richiesta?</AlertDialogTitle>
            <AlertDialogDescription>
              {requestType === "account_and_children" && children.length > 0
                ? `La richiesta riguarderà il tuo account e gli account di: ${children
                    .map((c) => c.full_name)
                    .join(", ")}.`
                : "La richiesta verrà registrata e verificata manualmente dal nostro team."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={submit}>Invia richiesta</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
