import { useEffect, useState } from "react";
import { Snowflake, Sparkles, Calendar, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FreezeRow {
  id: string;
  freeze_type: "homework" | "attendance";
  used_at: string;
  reason: string | null;
  auto_consumed: boolean;
}

interface Props {
  studentId: string;
}

const MAX_PER_MONTH = 2;

export function StreakFreezeCard({ studentId }: Props) {
  const { toast } = useToast();
  const [freezes, setFreezes] = useState<FreezeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<null | "homework" | "attendance">(null);
  const [openType, setOpenType] = useState<null | "homework" | "attendance">(null);

  const load = async () => {
    setLoading(true);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("streak_freezes")
      .select("id, freeze_type, used_at, reason, auto_consumed")
      .eq("student_id", studentId)
      .gte("used_at", startOfMonth.toISOString())
      .order("used_at", { ascending: false });

    setFreezes((data || []) as FreezeRow[]);
    setLoading(false);
  };

  useEffect(() => {
    if (studentId) load();
  }, [studentId]);

  const countByType = (t: "homework" | "attendance") =>
    freezes.filter((f) => f.freeze_type === t).length;

  const useFreeze = async (t: "homework" | "attendance") => {
    setSubmitting(t);
    const { data, error } = await supabase.rpc("use_my_streak_freeze", {
      _student_id: studentId,
      _freeze_type: t,
      _reason: "Attivato manualmente dall'alunno",
    });

    setSubmitting(null);
    setOpenType(null);

    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }

    const result = data as { success: boolean; error?: string; remaining?: number };
    if (!result?.success) {
      const msg =
        result?.error === "limit_reached"
          ? "Hai già usato i 2 freeze di questo mese."
          : "Impossibile attivare il freeze.";
      toast({ title: "Freeze non disponibile", description: msg, variant: "destructive" });
      return;
    }

    toast({
      title: "🧊 Freeze attivato!",
      description: `Streak protetta. Te ne restano ${result.remaining} questo mese.`,
    });
    load();
  };

  if (loading) {
    return (
      <Card className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </Card>
    );
  }

  const renderRow = (t: "homework" | "attendance", label: string) => {
    const used = countByType(t);
    const remaining = MAX_PER_MONTH - used;
    const canUse = remaining > 0;

    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-tech-cyan/10 flex items-center justify-center flex-shrink-0">
            <Snowflake className="w-5 h-5 text-tech-cyan" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">
              {used}/{MAX_PER_MONTH} usati questo mese
            </p>
          </div>
        </div>
        <Dialog open={openType === t} onOpenChange={(o) => setOpenType(o ? t : null)}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={!canUse}>
              🧊 Usa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Attiva un Freeze {t === "homework" ? "Compiti" : "Presenze"}</DialogTitle>
              <DialogDescription>
                Un Freeze protegge la tua streak da un'eventuale "rottura" futura:
                {t === "homework"
                  ? " se consegnerai un compito in ritardo, la streak non si azzera."
                  : " se salterai una lezione senza giustifica, la streak presenze non si azzera."}
                <br />
                <br />
                Hai ancora <strong>{remaining}/{MAX_PER_MONTH}</strong> freeze disponibili questo mese.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpenType(null)}>
                Annulla
              </Button>
              <Button
                onClick={() => useFreeze(t)}
                disabled={submitting !== null}
                className="bg-tech-cyan hover:bg-tech-cyan/90"
              >
                {submitting === t ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Snowflake className="w-4 h-4 mr-1" /> Conferma
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Snowflake className="w-5 h-5 text-tech-cyan" />
        <h3 className="font-semibold">Streak Freeze</h3>
        <Badge variant="outline" className="ml-auto text-xs">
          <Sparkles className="w-3 h-3 mr-1" /> Salva la serie
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Hai <strong>2 freeze al mese</strong> per ogni tipo: usali per non perdere la streak se sai
        che salterai un compito o una lezione. Le assenze giustificate non rompono mai la streak.
      </p>

      <div className="space-y-2">
        {renderRow("homework", "Freeze Compiti")}
        {renderRow("attendance", "Freeze Presenze")}
      </div>

      {freezes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Usati questo mese
          </p>
          <ul className="space-y-1.5">
            {freezes.map((f) => (
              <li key={f.id} className="text-xs text-muted-foreground flex items-center gap-2">
                <Snowflake className="w-3 h-3 text-tech-cyan flex-shrink-0" />
                <span className="truncate">
                  {f.freeze_type === "homework" ? "Compiti" : "Presenze"} •{" "}
                  {new Date(f.used_at).toLocaleDateString("it-IT")} •{" "}
                  {f.auto_consumed ? "automatico" : "manuale"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
