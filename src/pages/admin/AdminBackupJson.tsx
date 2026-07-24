import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonImportExport } from "@/components/admin/JsonImportExport";
import { Loader2, Download, RefreshCw, Play, Trash2, FolderOpen } from "lucide-react";

interface EntityRow {
  label: string;
  table: string;
  conflict: string;
  strip: string[];
  canImport: boolean;
}

const ENTITIES: EntityRow[] = [
  { label: "Articoli blog", table: "blog_posts", conflict: "slug", strip: ["created_at","updated_at"], canImport: true },
  { label: "Corsi", table: "courses", conflict: "slug", strip: ["created_at","updated_at"], canImport: true },
  { label: "Lezioni", table: "lessons", conflict: "id", strip: ["created_at","updated_at"], canImport: true },
  { label: "Task lezione", table: "lesson_tasks", conflict: "id", strip: ["created_at","updated_at"], canImport: true },
  { label: "Compiti (homework)", table: "homework", conflict: "id", strip: ["created_at","updated_at"], canImport: true },
  { label: "Glossario", table: "glossary_terms", conflict: "slug", strip: ["created_at","updated_at"], canImport: true },
  { label: "Landing pages", table: "landing_pages", conflict: "slug", strip: ["created_at","updated_at"], canImport: true },
  { label: "Site settings", table: "site_settings", conflict: "key", strip: ["updated_at"], canImport: true },
  { label: "Badge", table: "badges", conflict: "id", strip: ["created_at"], canImport: true },
  { label: "Newsletter iscritti", table: "newsletter_subscribers", conflict: "email", strip: ["created_at"], canImport: true },
  { label: "Email bloccate", table: "blocked_emails", conflict: "pattern", strip: ["created_at"], canImport: true },
  { label: "Lead CRM", table: "crm_leads", conflict: "email", strip: ["notion_page_id","notion_last_sync_at","notion_sync_error"], canImport: true },
  // Solo export
  { label: "Prenotazioni trial (solo export)", table: "trial_bookings", conflict: "id", strip: [], canImport: false },
  { label: "Contatti (solo export)", table: "contact_submissions", conflict: "id", strip: [], canImport: false },
  { label: "Referral (solo export)", table: "referrals", conflict: "id", strip: [], canImport: false },
  { label: "Interazioni CRM (solo export)", table: "crm_interactions", conflict: "id", strip: [], canImport: false },
  { label: "Compiti consegnati (solo export)", table: "homework_submissions", conflict: "id", strip: [], canImport: false },
  { label: "Log accessi admin (solo export)", table: "admin_access_logs", conflict: "id", strip: [], canImport: false },
];

interface StorageFile {
  name: string;
  path: string;
  size: number;
  updated_at: string;
}

export default function AdminBackupJson() {
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [busy, setBusy] = useState<"snapshot" | "cleanup" | null>(null);
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/admin/login");
  }, [user, isAdmin, authLoading, navigate]);

  const loadFiles = async () => {
    setLoadingFiles(true);
    try {
      const all: StorageFile[] = [];
      const { data: years } = await supabase.storage.from("backups-json").list("", { limit: 100 });
      for (const y of years ?? []) {
        if (!/^\d{4}$/.test(y.name)) continue;
        const { data: months } = await supabase.storage.from("backups-json").list(y.name, { limit: 100 });
        for (const m of months ?? []) {
          if (!/^\d{2}$/.test(m.name)) continue;
          const monthPath = `${y.name}/${m.name}`;
          const { data: fs } = await supabase.storage.from("backups-json").list(monthPath, { limit: 10000 });
          for (const f of fs ?? []) {
            if (!f.name.endsWith(".json")) continue;
            all.push({
              name: f.name,
              path: `${monthPath}/${f.name}`,
              size: (f as any).metadata?.size ?? 0,
              updated_at: (f as any).updated_at ?? f.created_at ?? "",
            });
          }
        }
      }
      all.sort((a, b) => b.path.localeCompare(a.path));
      setFiles(all);
    } catch (e: any) {
      toast({ title: "Errore lettura Storage", description: e.message, variant: "destructive" });
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => { if (user && isAdmin) loadFiles(); }, [user, isAdmin]);

  const runSnapshot = async () => {
    setBusy("snapshot");
    try {
      const { data, error } = await supabase.functions.invoke("backup-json-snapshot", { body: {} });
      if (error) throw error;
      toast({ title: "Snapshot creato", description: `${(data as any)?.tables ?? 0} tabelle salvate su Storage` });
      loadFiles();
    } catch (e: any) {
      toast({ title: "Errore snapshot", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const runCleanup = async () => {
    setBusy("cleanup");
    try {
      const { data, error } = await supabase.functions.invoke("backup-json-cleanup", { body: {} });
      if (error) throw error;
      toast({ title: "Pulizia completata", description: `${(data as any)?.deleted ?? 0} file eliminati` });
      loadFiles();
    } catch (e: any) {
      toast({ title: "Errore pulizia", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const downloadFile = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("backups-json").createSignedUrl(path, 60);
    if (error || !data) {
      toast({ title: "Errore download", description: error?.message, variant: "destructive" });
      return;
    }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = name;
    a.click();
  };

  const deleteFile = async (path: string) => {
    if (!confirm(`Eliminare ${path}?`)) return;
    const { error } = await supabase.storage.from("backups-json").remove([path]);
    if (error) toast({ title: "Errore", description: error.message, variant: "destructive" });
    else { toast({ title: "Eliminato" }); loadFiles(); }
  };

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) {
      const m = f.path.match(/^(\d{4}\/\d{2})\//);
      if (m) set.add(m[1]);
    }
    return [...set].sort().reverse();
  }, [files]);

  const filteredFiles = useMemo(
    () => monthFilter === "all" ? files : files.filter(f => f.path.startsWith(monthFilter + "/")),
    [files, monthFilter]
  );

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />
      <AdminNav />
      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1">Backup JSON</h1>
        <p className="text-muted-foreground mb-6">Export/import manuale e archivio automatico su Storage.</p>

        <Tabs defaultValue="manual">
          <TabsList className="mb-4">
            <TabsTrigger value="manual">Export / Import manuale</TabsTrigger>
            <TabsTrigger value="storage">Archivio automatico</TabsTrigger>
          </TabsList>

          <TabsContent value="manual">
            <div className="tech-card p-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Entità</th>
                    <th className="py-2 pr-4">Tabella</th>
                    <th className="py-2 pr-4">Chiave conflitto</th>
                    <th className="py-2">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {ENTITIES.map((e) => (
                    <tr key={e.table} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{e.label}</td>
                      <td className="py-2 pr-4 text-muted-foreground font-mono text-xs">{e.table}</td>
                      <td className="py-2 pr-4 text-muted-foreground font-mono text-xs">{e.canImport ? e.conflict : "—"}</td>
                      <td className="py-2">
                        {e.canImport ? (
                          <JsonImportExport
                            filePrefix={e.table.replace(/_/g, "-")}
                            tableName={e.table}
                            conflictColumn={e.conflict}
                            stripColumns={e.strip}
                            entityLabel={e.label.toLowerCase()}
                          />
                        ) : (
                          <ExportOnly table={e.table} label={e.label} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="storage">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <Button size="sm" onClick={runSnapshot} disabled={!!busy}>
                {busy === "snapshot" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Esegui snapshot ora
              </Button>
              <Button size="sm" variant="outline" onClick={runCleanup} disabled={!!busy}>
                {busy === "cleanup" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Esegui pulizia ora
              </Button>
              <Button size="sm" variant="ghost" onClick={loadFiles} disabled={loadingFiles}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingFiles ? "animate-spin" : ""}`} />
                Ricarica
              </Button>
              <div className="ml-auto flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Mese:</span>
                <select className="border rounded px-2 py-1 bg-background text-sm"
                        value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
                  <option value="all">Tutti</option>
                  {months.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="text-xs text-muted-foreground mb-3">
              Cron giornaliero 03:00 UTC (snapshot) e mensile 1° 04:00 UTC (pulizia). Retention: ultimi 90 giorni + 1 snapshot/mese negli ultimi 12 mesi.
            </div>

            <div className="tech-card p-4">
              {loadingFiles ? (
                <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
              ) : filteredFiles.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2" />
                  Nessun file. Esegui uno snapshot per iniziare.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-4">Percorso</th>
                        <th className="py-2 pr-4">Dimensione</th>
                        <th className="py-2 pr-4">Aggiornato</th>
                        <th className="py-2">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFiles.map((f) => (
                        <tr key={f.path} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-mono text-xs">{f.path}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</td>
                          <td className="py-2 pr-4 text-muted-foreground">
                            {f.updated_at ? new Date(f.updated_at).toLocaleString("it-IT") : "—"}
                          </td>
                          <td className="py-2 flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => downloadFile(f.path, f.name)}>
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteFile(f.path)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ExportOnly({ table, label }: { table: string; label: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase.from(table as any) as any).select("*").limit(20000);
      if (error) throw error;
      const rows = data ?? [];
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${table}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Esportati ${rows.length} record` });
    } catch (e: any) {
      toast({ title: "Errore export", description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  };
  return (
    <Button size="sm" variant="outline" onClick={run} disabled={busy}>
      {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
      Esporta JSON
    </Button>
  );
}
