import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Gift, Share2, Loader2 } from "lucide-react";

interface ReferralRow {
  id: string;
  referred_email: string | null;
  status: string;
  created_at: string;
  reward_reason: string | null;
}

export function ReferralCard() {
  const { toast } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .maybeSingle();
      setCode(profile?.referral_code ?? null);
      const { data: refs } = await supabase
        .from("referrals")
        .select("id, referred_email, status, created_at, reward_reason")
        .eq("referrer_id", user.id)
        .order("created_at", { ascending: false });
      setRows((refs || []) as ReferralRow[]);
      setLoading(false);
    };
    load();
  }, []);

  const link = code ? `${window.location.origin}/prenota?ref=${code}` : "";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiato!` });
  };

  const share = async () => {
    if (navigator.share && link) {
      try {
        await navigator.share({
          title: "TECHLAND - Corsi di coding per ragazzi",
          text: `Iscriviti con il mio codice ${code} e riceviamo entrambi una lezione gratis!`,
          url: link,
        });
      } catch {}
    } else {
      copy(link, "Link");
    }
  };

  const rewarded = rows.filter((r) => r.status === "rewarded").length;

  if (loading) {
    return (
      <Card className="p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </Card>
    );
  }

  if (!code) return null;

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <div className="flex items-center gap-2 mb-2">
        <Gift className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Invita un amico, vincete entrambi 🎁</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Per ogni famiglia che si iscrive con il tuo codice, <strong>tu e loro ricevete 1 lezione gratis</strong>.
        L'accredito viene effettuato manualmente dall'admin dopo il primo pagamento.
      </p>

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <div className="bg-background rounded-lg p-3 border">
          <div className="text-xs text-muted-foreground mb-1">Il tuo codice</div>
          <div className="flex items-center gap-2">
            <code className="text-lg font-bold tracking-wider text-primary">{code}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(code, "Codice")}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="bg-background rounded-lg p-3 border">
          <div className="text-xs text-muted-foreground mb-1">Link invito</div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="text-xs bg-transparent flex-1 truncate outline-none"
            />
            <Button size="icon" variant="ghost" onClick={() => copy(link, "Link")}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Button onClick={share} className="w-full sm:w-auto">
        <Share2 className="w-4 h-4 mr-2" /> Condividi invito
      </Button>

      <div className="mt-4 flex gap-4 text-sm">
        <span><strong>{rows.length}</strong> inviti totali</span>
        <span className="text-green-600"><strong>{rewarded}</strong> premiati</span>
      </div>

      {rows.length > 0 && (
        <div className="mt-4 space-y-1">
          <div className="text-xs font-semibold text-muted-foreground mb-1">Ultimi inviti</div>
          {rows.slice(0, 5).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm py-1 border-t">
              <span className="truncate">{r.referred_email || "—"}</span>
              <Badge
                variant={r.status === "rewarded" ? "default" : r.status === "rejected" ? "destructive" : "secondary"}
                className="text-xs"
              >
                {r.status === "pending" && "In attesa"}
                {r.status === "qualified" && "Qualificato"}
                {r.status === "rewarded" && "Premiato 🎉"}
                {r.status === "rejected" && "Rifiutato"}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
