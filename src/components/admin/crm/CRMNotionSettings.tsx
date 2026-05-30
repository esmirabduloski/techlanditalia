import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Database, BookOpen, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PropertyMapping {
  title: string;
  email: string;
  phone: string;
  pipeline_stage: string;
  source: string;
  lead_score: string;
  lifetime_value_cents: string;
  tags: string;
  next_followup_at: string;
  last_contacted_at: string;
  child_age: string;
  interest: string;
  notes: string;
  original_message: string;
  created_at: string;
}

interface Settings {
  enabled: boolean;
  database_id: string | null;
  property_mapping: PropertyMapping;
}

interface SyncLog {
  id: string;
  lead_id: string | null;
  operation: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<keyof PropertyMapping, string> = {
  title: "Nome (Title)",
  email: "Email",
  phone: "Telefono",
  pipeline_stage: "Stage pipeline (Select)",
  source: "Origine (Select)",
  lead_score: "Lead score (Number)",
  lifetime_value_cents: "LTV € (Number)",
  tags: "Tag (Multi-select)",
  next_followup_at: "Prossimo follow-up (Date)",
  last_contacted_at: "Ultimo contatto (Date)",
  child_age: "Età alunno (Number)",
  interest: "Interesse (Rich text)",
  notes: "Note (Rich text)",
  original_message: "Messaggio originale (Rich text)",
  created_at: "Creato il (Date)",
};

export function CRMNotionSettings({ totalLeads }: { totalLeads: number }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<{ done: number; total: number } | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [syncedCount, setSyncedCount] = useState(0);

  const loadAll = async () => {
    const [{ data: s }, { data: l }, { count }] = await Promise.all([
      supabase.from("crm_notion_settings").select("enabled, database_id, property_mapping").eq("singleton", true).maybeSingle(),
      supabase.from("crm_notion_sync_log").select("id, lead_id, operation, status, error_message, created_at").order("created_at", { ascending: false }).limit(15),
      supabase.from("crm_leads").select("id", { count: "exact", head: true }).not("notion_page_id", "is", null),
    ]);
    if (s) setSettings(s as unknown as Settings);
    setLogs((l ?? []) as SyncLog[]);
    setSyncedCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const updateSettings = (patch: Partial<Settings>) => {
    if (!settings) return;
    setSettings({ ...settings, ...patch });
  };

  const updateMapping = (field: keyof PropertyMapping, value: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      property_mapping: { ...settings.property_mapping, [field]: value },
    });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase
      .from("crm_notion_settings")
      .update({
        enabled: settings.enabled,
        database_id: settings.database_id?.trim() || null,
        property_mapping: settings.property_mapping as any,
      })
      .eq("singleton", true);
    setSaving(false);
    if (error) {
      toast({ title: "Errore salvataggio", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Impostazioni salvate" });
      loadAll();
    }
  };

  const testConnection = async () => {
    if (!settings?.database_id) {
      toast({ title: "Inserisci prima il Database ID", variant: "destructive" });
      return;
    }
    // Create a fake test lead by sending operation=create against a dummy lead
    // Better: just check we can hit the function and it returns OK with settings
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!lead) {
      toast({ title: "Nessun lead esistente per testare", description: "Crea almeno un lead prima di testare", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.functions.invoke("sync-lead-to-notion", {
      body: { lead_id: lead.id, operation: "update" },
    });
    if (error) {
      toast({ title: "Test fallito", description: error.message, variant: "destructive" });
    } else if ((data as any)?.ok) {
      toast({ title: "✅ Connessione OK", description: "Notion ha risposto correttamente" });
      loadAll();
    } else {
      toast({
        title: "⚠️ Risposta non valida",
        description: JSON.stringify(data).slice(0, 200),
        variant: "destructive",
      });
    }
  };

  const backfillAll = async () => {
    if (!settings?.enabled || !settings?.database_id) {
      toast({ title: "Abilita prima la sincronizzazione e salva il Database ID", variant: "destructive" });
      return;
    }
    if (!confirm(`Sincronizzare tutti i ${totalLeads} lead esistenti su Notion? L'operazione può richiedere alcuni minuti.`)) return;

    setBackfilling(true);
    setBackfillProgress({ done: 0, total: totalLeads });

    const { data: allLeads } = await supabase.from("crm_leads").select("id, notion_page_id");
    const list = allLeads ?? [];
    let done = 0;
    let errors = 0;

    // Process in small batches to respect Notion rate limit (3 req/s)
    for (const lead of list) {
      const { data, error } = await supabase.functions.invoke("sync-lead-to-notion", {
        body: {
          lead_id: lead.id,
          operation: lead.notion_page_id ? "update" : "create",
          notion_page_id: lead.notion_page_id,
        },
      });
      if (error || !(data as any)?.ok) errors++;
      done++;
      setBackfillProgress({ done, total: list.length });
      // ~3 req/s
      await new Promise((r) => setTimeout(r, 400));
    }

    setBackfilling(false);
    setBackfillProgress(null);
    toast({
      title: `Backfill completato`,
      description: `${done - errors}/${done} sincronizzati${errors > 0 ? ` · ${errors} errori` : ""}`,
      variant: errors > 0 ? "destructive" : "default",
    });
    loadAll();
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" /> Sincronizzazione Notion
              </CardTitle>
              <CardDescription>
                Push automatico dei lead dal CRM verso il tuo database Notion. Modifica solo dal sito.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={settings.enabled ? "default" : "secondary"}>
                {settings.enabled ? "Attiva" : "Disattiva"}
              </Badge>
              <div className="flex items-center gap-2">
                <Label htmlFor="enabled" className="text-sm">Abilita sync</Label>
                <Switch
                  id="enabled"
                  checked={settings.enabled}
                  onCheckedChange={(v) => updateSettings({ enabled: v })}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Lead totali</div>
              <div className="text-2xl font-bold">{totalLeads}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Sincronizzati su Notion</div>
              <div className="text-2xl font-bold text-primary">{syncedCount}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Da sincronizzare</div>
              <div className="text-2xl font-bold">{Math.max(totalLeads - syncedCount, 0)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurazione</CardTitle>
          <CardDescription>
            Il connettore Notion è già collegato. Inserisci l'ID del database e personalizza i nomi delle colonne se diversi da quelli predefiniti.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="dbid">Database ID Notion *</Label>
            <Input
              id="dbid"
              placeholder="es. 1a2b3c4d5e6f7g8h9i0j..."
              value={settings.database_id ?? ""}
              onChange={(e) => updateSettings({ database_id: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lo trovi nell'URL del tuo database Notion: <code className="bg-muted px-1 rounded">notion.so/.../<strong>DATABASE_ID</strong>?v=...</code>
              {" "}— assicurati di aver condiviso il database con il connettore Lovable durante la procedura di OAuth.
            </p>
          </div>

          <details className="border rounded-lg p-3">
            <summary className="cursor-pointer font-medium text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Mapping nomi colonne Notion (avanzato)
            </summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              {(Object.keys(FIELD_LABELS) as Array<keyof PropertyMapping>).map((k) => (
                <div key={k}>
                  <Label className="text-xs">{FIELD_LABELS[k]}</Label>
                  <Input
                    value={settings.property_mapping[k]}
                    onChange={(e) => updateMapping(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Inserisci il nome esatto di ogni proprietà nel tuo database Notion (case-sensitive). I valori di tipo Select e Multi-select vengono creati automaticamente se non esistono.
            </p>
          </details>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Salva impostazioni
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={!settings.database_id}>
              Testa connessione
            </Button>
            <Button
              variant="secondary"
              onClick={backfillAll}
              disabled={backfilling || !settings.enabled || !settings.database_id || totalLeads === 0}
            >
              {backfilling && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <RefreshCw className="w-4 h-4 mr-1" />
              {backfillProgress
                ? `Sincronizzazione ${backfillProgress.done}/${backfillProgress.total}…`
                : `Sincronizza tutti i ${totalLeads} lead`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How it works */}
      <Alert>
        <AlertTitle>Come funziona</AlertTitle>
        <AlertDescription className="space-y-1 text-sm">
          <p>• Ogni nuovo lead o modifica viene replicato automaticamente su Notion in background.</p>
          <p>• Notion è di sola consultazione: <strong>modifiche fatte direttamente su Notion non torneranno qui sul sito</strong>.</p>
          <p>• Le eliminazioni archiviano la pagina Notion (rimane nel cestino 30 giorni).</p>
          <p>• Rate limit: max 3 sincronizzazioni/secondo (gestito automaticamente).</p>
        </AlertDescription>
      </Alert>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ultimi eventi di sincronizzazione</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun evento ancora.</p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-auto text-sm">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 py-1.5 border-b last:border-0">
                  {log.status === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{log.operation}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("it-IT")}
                      </span>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-destructive mt-0.5 break-words">{log.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
