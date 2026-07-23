import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  /** Nome file (senza estensione) es. "blog-posts" */
  filePrefix: string;
  /** Tabella Supabase da cui esportare / in cui importare */
  tableName: string;
  /** Colonna di conflitto per l'upsert (es. "slug", "email") */
  conflictColumn: string;
  /** Colonne da rimuovere prima dell'upsert (es. campi auto-gen) */
  stripColumns?: string[];
  /** Callback dopo import completato */
  onImported?: () => void;
  /** Label breve per i toast (es. "articoli", "corsi", "lead") */
  entityLabel: string;
}

export function JsonImportExport({
  filePrefix,
  tableName,
  conflictColumn,
  stripColumns = [],
  onImported,
  entityLabel,
}: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  const handleExport = async () => {
    setBusy("export");
    try {
      const { data, error } = await (supabase.from(tableName as any) as any)
        .select("*")
        .limit(10000);
      if (error) throw error;
      const rows = data ?? [];
      const blob = new Blob([JSON.stringify(rows, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filePrefix}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Esportati ${rows.length} ${entityLabel}` });
    } catch (e: any) {
      toast({ title: "Errore export", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleImport = async (file: File) => {
    setBusy("import");
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const rows: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.items)
        ? parsed.items
        : Array.isArray(parsed?.data)
        ? parsed.data
        : null;
      if (!rows) throw new Error("JSON non valido: attesa array di record");

      const cleaned = rows.map((r) => {
        const copy: any = { ...r };
        for (const col of stripColumns) delete copy[col];
        return copy;
      });

      // Chunk gli upsert per evitare payload enormi
      const chunkSize = 200;
      let inserted = 0;
      for (let i = 0; i < cleaned.length; i += chunkSize) {
        const chunk = cleaned.slice(i, i + chunkSize);
        const { error } = await (supabase.from(tableName as any) as any).upsert(chunk, {
          onConflict: conflictColumn,
        });
        if (error) throw error;
        inserted += chunk.length;
      }

      toast({ title: `Importati ${inserted} ${entityLabel}` });
      onImported?.();
    } catch (e: any) {
      toast({ title: "Errore import", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={!!busy}>
        {busy === "export" ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-1" />
        )}
        Esporta JSON
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={!!busy}
      >
        {busy === "import" ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Upload className="w-4 h-4 mr-1" />
        )}
        Importa JSON
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
        }}
      />
    </div>
  );
}
