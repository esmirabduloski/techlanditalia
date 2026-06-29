import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { AdminNav } from "@/components/admin/AdminNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Loader2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Term {
  id: string;
  term: string;
  slug: string;
  definition: string;
  short_definition: string | null;
  category: string;
  is_published: boolean;
}

const CATEGORIES = ["general", "scratch", "python", "roblox", "ai", "web"];

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const emptyForm: Omit<Term, "id"> = {
  term: "",
  slug: "",
  definition: "",
  short_definition: "",
  category: "general",
  is_published: true,
};

export default function AdminGlossary() {
  const { toast } = useToast();
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Term | null>(null);
  const [form, setForm] = useState<Omit<Term, "id">>(emptyForm);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("glossary_terms")
      .select("*")
      .order("term");
    setTerms((data || []) as Term[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (t: Term) => {
    setEditing(t);
    setForm({
      term: t.term,
      slug: t.slug,
      definition: t.definition,
      short_definition: t.short_definition,
      category: t.category,
      is_published: t.is_published,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.term.trim() || !form.definition.trim()) {
      toast({ title: "Compila almeno termine e definizione", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      slug: form.slug?.trim() || slugify(form.term),
      short_definition: form.short_definition || null,
    };
    const res = editing
      ? await supabase.from("glossary_terms").update(payload).eq("id", editing.id)
      : await supabase.from("glossary_terms").insert(payload);
    setSaving(false);
    if (res.error) {
      toast({ title: "Errore", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Termine aggiornato" : "Termine creato" });
    setOpen(false);
    load();
  };

  const remove = async (t: Term) => {
    if (!confirm(`Eliminare "${t.term}"?`)) return;
    const { error } = await supabase.from("glossary_terms").delete().eq("id", t.id);
    if (error) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Termine eliminato" });
    load();
  };

  const filtered = terms.filter((t) =>
    !query ||
    t.term.toLowerCase().includes(query.toLowerCase()) ||
    t.definition.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Layout>
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-primary" /> Glossario
            </h1>
            <p className="text-sm text-muted-foreground">
              {terms.length} termini • visibili in /glossario e nei tooltip in lezione
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Cerca..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-56"
            />
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" /> Nuovo
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {filtered.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{t.term}</h3>
                    <Badge variant="outline" className="text-xs capitalize">{t.category}</Badge>
                    {!t.is_published && <Badge variant="secondary" className="text-xs">Bozza</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(t)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {t.short_definition || t.definition}
                </p>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifica termine" : "Nuovo termine"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Termine *</Label>
                  <Input
                    value={form.term}
                    onChange={(e) => setForm({ ...form, term: e.target.value, slug: editing ? form.slug : slugify(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Definizione breve (per tooltip in-lezione)</Label>
                <Textarea
                  rows={2}
                  value={form.short_definition || ""}
                  onChange={(e) => setForm({ ...form, short_definition: e.target.value })}
                />
              </div>
              <div>
                <Label>Definizione completa *</Label>
                <Textarea
                  rows={5}
                  value={form.definition}
                  onChange={(e) => setForm({ ...form, definition: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_published} onCheckedChange={(c) => setForm({ ...form, is_published: c })} />
                <Label>Pubblicato</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
