import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface AccessLog {
  id: string;
  admin_id: string;
  action: string;
  path: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  metadata: any;
  admin_email?: string;
  admin_name?: string;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  login: { label: "Login", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  view_page: { label: "Visita pagina", color: "bg-gray-500/10 text-gray-700 dark:text-gray-300" },
  data_export: { label: "Export dati", color: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  sensitive_action: { label: "Azione sensibile", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
  user_created: { label: "Utente creato", color: "bg-green-500/10 text-green-700 dark:text-green-300" },
  role_changed: { label: "Ruolo modificato", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
};

export default function AdminAccessLogs() {
  const { isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    if (!authLoading && !isAdmin) navigate("/auth");
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("admin_access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

      if (!error && data) {
        const adminIds = Array.from(new Set(data.map((l: any) => l.admin_id).filter(Boolean)));
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, full_name")
          .in("id", adminIds.length ? adminIds : ["00000000-0000-0000-0000-000000000000"]);
        const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
        setLogs(
          data.map((l: any) => ({
            ...l,
            admin_email: profileMap.get(l.admin_id)?.email,
            admin_name: profileMap.get(l.admin_id)?.full_name,
          }))
        );
      }
      setLoading(false);
    })();
  }, [isAdmin]);

  const filtered = logs.filter((l) => {
    if (actionFilter !== "all" && l.action !== actionFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        (l.admin_email || "").toLowerCase().includes(q) ||
        (l.admin_name || "").toLowerCase().includes(q) ||
        (l.path || "").toLowerCase().includes(q) ||
        (l.ip_address || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (authLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Log Accessi Admin</h1>
            <p className="text-muted-foreground text-sm">
              Tracciamento di login e azioni sensibili. Conservati 90 giorni.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per email, nome, IP, path…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue placeholder="Filtra per azione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le azioni</SelectItem>
              {Object.entries(actionLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {loading ? "Caricamento…" : `${filtered.length} eventi`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-muted-foreground">Nessun evento trovato.</p>
            ) : (
              <div className="space-y-2">
                {filtered.map((log) => {
                  const meta = actionLabels[log.action] || { label: log.action, color: "bg-muted" };
                  return (
                    <div key={log.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                      <Badge className={meta.color + " whitespace-nowrap"}>{meta.label}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {log.admin_name || log.admin_email || log.admin_id.slice(0, 8)}
                        </div>
                        {log.path && <div className="text-xs text-muted-foreground font-mono truncate">{log.path}</div>}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.ip_address || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: it })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
