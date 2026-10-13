import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { romeTodayIso } from "@/lib/subscriptionPause";

type LastReport = { month: string; sent_at: string | null; sent_to: string[] };

const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, 1)));
};

/** Ultimi 12 mesi chiusi, dal più recente. */
function closedMonths(today = romeTodayIso()): string[] {
  let [y, m] = today.slice(0, 7).split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

/** Report mensile (edge function monthly-report): ultimo invio e "Inviamelo ora". */
export function CRMMonthlyReportCard() {
  const { toast } = useToast();
  const months = useMemo(() => closedMonths(), []);
  const [month, setMonth] = useState(months[0]);
  const [sending, setSending] = useState(false);
  const [last, setLast] = useState<LastReport | null>(null);

  useEffect(() => {
    supabase
      .from("monthly_reports")
      .select("month, sent_at, sent_to")
      .not("sent_at", "is", null)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLast(data as LastReport | null));
  }, []);

  const send = async () => {
    setSending(true);
    const { data, error } = await supabase.functions.invoke("monthly-report", { body: { month } });
    setSending(false);
    if (error || data?.error || !data?.sent_to?.length) {
      toast({
        title: "Report non inviato",
        description: data?.error ?? error?.message ?? "Invio dell'email non riuscito",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Report inviato", description: `Report di ${monthLabel(month)} inviato a ${data.sent_to[0]}` });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Mail className="w-4 h-4" />Report mensile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Il primo di ogni mese tutti gli admin ricevono per email iscrizioni, disdette, incassi, prove,
          conversione e soddisfazione del mese appena chiuso, con il confronto sul mese prima.
          {last?.sent_at && (
            <> Ultimo invio: {monthLabel(last.month)}, a {last.sent_to.length} admin.</>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => <SelectItem key={m} value={m} className="capitalize">{monthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={send} disabled={sending}>
            {sending ? "Invio…" : "Inviamelo ora"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
