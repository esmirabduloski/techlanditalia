import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { generateChildPassword, validateChildPassword } from "@/lib/childPassword";

interface ChildPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  child: { id: string; full_name: string; username: string | null };
}

/**
 * Il genitore sceglie la password del figlio (edge function
 * parent-set-child-password). Alla fine mostra nome utente e password da
 * dare al figlio: la password non viene salvata da nessuna parte in chiaro.
 */
export function ChildPasswordDialog({ open, onOpenChange, child }: ChildPasswordDialogProps) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setConfirm("");
      setError(null);
      setSaved(null);
      setCopied(false);
    }
  }, [open, child.id]);

  const generate = () => {
    const pw = generateChildPassword();
    setPassword(pw);
    setConfirm(pw);
    setError(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const invalid = validateChildPassword(password);
    if (invalid) return setError(invalid);
    if (password !== confirm) return setError("Le due password non coincidono");

    setSaving(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke("parent-set-child-password", {
      body: { childId: child.id, newPassword: password },
    });
    setSaving(false);

    if (invokeError || data?.error) {
      // Con risposte 4xx supabase-js mette il corpo in error.context, non in data
      let message = data?.error as string | undefined;
      if (!message && invokeError && "context" in invokeError) {
        try {
          message = (await (invokeError.context as Response).clone().json())?.error;
        } catch {
          // corpo non leggibile
        }
      }
      setError(message || "Impossibile aggiornare la password. Riprova più tardi.");
      return;
    }

    setSaved(password);
    toast({ title: "Password aggiornata", description: `${child.full_name} può entrare con la nuova password.` });
  };

  const copy = async () => {
    if (!saved) return;
    const text = child.username ? `Nome utente: ${child.username}\nPassword: ${saved}` : saved;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      toast({ variant: "destructive", title: "Copia non riuscita", description: "Seleziona e copia il testo a mano." });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Nuova password di {child.full_name}
          </DialogTitle>
          <DialogDescription>
            {saved
              ? "Fatto. Dai questi dati a tuo figlio per entrare."
              : "Scegli la password con cui tuo figlio entra nell'area riservata. È separata dalla tua."}
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-2 font-mono text-sm">
              {child.username && (
                <p>
                  <span className="text-muted-foreground font-sans">Nome utente: </span>
                  <span data-testid="child-username">{child.username}</span>
                </p>
              )}
              <p>
                <span className="text-muted-foreground font-sans">Password: </span>
                <span data-testid="child-new-password">{saved}</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Se tuo figlio era bloccato per troppi tentativi sbagliati, ora può riprovare subito.
            </p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copiato" : "Copia"}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>Chiudi</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="child-new-password">Nuova password</Label>
                <Button type="button" variant="ghost" size="sm" onClick={generate} disabled={saving}>
                  <Wand2 className="w-4 h-4 mr-1" />
                  Genera
                </Button>
              </div>
              <PasswordInput
                id="child-new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">Almeno 8 caratteri, con lettere e numeri.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="child-confirm-password">Ripeti la password</Label>
              <PasswordInput
                id="child-confirm-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={saving}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Annulla
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salva password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
