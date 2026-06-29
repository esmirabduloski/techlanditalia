import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Gift, Loader2, Check, X, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ReferralRow {
  id: string;
  referrer_id: string;
  referrer_code: string;
  referred_email: string | null;
  referred_profile_id: string | null;
  status: string;
  source_url: string | null;
  notes: string | null;
  reward_reason: string | null;
  created_at: string;
  rewarded_at: string | null;
  referrer?: { full_name: string | null; email: string | null } | null;
  referred?: { full_name: string | null; email: string | null } | null;
}

export default function AdminReferrals() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [query, setQuery] = useState("");
  const [rewardOpen, setRewardOpen] = useState(false);
  const [target, setTarget] = useState<ReferralRow | null>(null);
  const [credits, setCredits] = useState(1);
  const [reason, setReason] = useState("Iscrizione confermata");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("referrals")
      .select(`
        id, referrer_id, referrer_code, referred_email, referred_profile_id,
        status, source_url, notes, reward_reason, created_at, rewarded_at,
        referrer:profiles!referrals_referrer_id_fkey(full_name, email),
        referred:profiles!referrals_referred_profile_id_fkey(full_name, email)
      `)
      .order("created_at", { ascending: false });
    setRows((data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openReward = (r: ReferralRow) => {
    setTarget(r);
    setCredits(1);
    setReason("Iscrizione confermata");
    setRewardOpen(true);
  };

  const doReward = async () => {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc("reward_referral", {
      _referral_id: target.id,
      _credits_each: credits,
      _reason: reason,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Referral premiato 🎉", description: `${credits} lezione/i accreditata/e a entrambe le famiglie` });
    setRewardOpen(false);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("referrals").update({ status }).eq("id", id);
    if (error) toast({ title: "Errore", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminare questo referral?")) return;
    await supabase.from("referrals").delete().eq("id", id);
    load();
  };

  const filtered = rows.filter((r) => {
    if (tab !== "all" && r.status !== tab) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      r.referred_email?.toLowerCase().includes(q) ||
      r.referrer_code?.toLowerCase().includes(q) ||
      r.referrer?.email?.toLowerCase().includes(q) ||
      r.referrer?.full_name?.toLowerCase().includes(q)
    );
  });

  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    qualified: rows.filter((r) => r.status === "qualified").length,
    rewarded: rows.filter((r) => r.status === "rewarded").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  return (
    <Layout>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="w-6 h-6 text-primary" /> Referral
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestisci gli inviti e accredita lezioni gratis a entrambe le famiglie.
            </p>
          </div>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Cerca email o codice..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pending">In attesa ({counts.pending})</TabsTrigger>
            <TabsTrigger value="qualified">Qualificati ({counts.qualified})</TabsTrigger>
            <TabsTrigger value="rewarded">Premiati ({counts.rewarded})</TabsTrigger>
            <TabsTrigger value="rejected">Rifiutati ({counts.rejected})</TabsTrigger>
            <TabsTrigger value="all">Tutti ({rows.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-4">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Nessun referral</Card>
            ) : (
              <div className="space-y-2">
                {filtered.map((r) => (
                  <Card key={r.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="text-sm font-bold text-primary">{r.referrer_code}</code>
                          <Badge
                            variant={
                              r.status === "rewarded" ? "default" :
                              r.status === "rejected" ? "destructive" : "secondary"
                            }
                            className="text-xs"
                          >
                            {r.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.created_at).toLocaleString("it-IT")}
                          </span>
                        </div>
                        <div className="mt-1 text-sm">
                          <strong>Da:</strong> {r.referrer?.full_name || "—"} ({r.referrer?.email || "—"})
                        </div>
                        <div className="text-sm">
                          <strong>Invitato:</strong>{" "}
                          {r.referred?.full_name || r.referred_email || "—"}
                          {r.referred?.email && r.referred?.email !== r.referred_email && (
                            <span className="text-muted-foreground"> ({r.referred.email})</span>
                          )}
                        </div>
                        {r.notes && <div className="text-xs text-muted-foreground mt-1">📝 {r.notes}</div>}
                        {r.reward_reason && (
                          <div className="text-xs text-green-600 mt-1">🎁 {r.reward_reason}</div>
                        )}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {r.status !== "rewarded" && (
                          <Button size="sm" onClick={() => openReward(r)}>
                            <Gift className="w-4 h-4 mr-1" /> Accredita
                          </Button>
                        )}
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "qualified")}>
                              <Check className="w-4 h-4 mr-1" /> Qualifica
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "rejected")}>
                              <X className="w-4 h-4 mr-1" /> Rifiuta
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                          🗑
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Accredita lezioni gratis</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Le lezioni verranno accreditate sia ai figli del referrer ({target?.referrer?.full_name || "—"}){" "}
                sia ai figli dell'invitato (se collegato).
              </p>
              <div>
                <Label>Lezioni per ciascun lato</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={credits}
                  onChange={(e) => setCredits(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <Label>Motivazione</Label>
                <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRewardOpen(false)}>Annulla</Button>
              <Button onClick={doReward} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Conferma e accredita"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
