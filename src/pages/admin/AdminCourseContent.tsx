import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminNav } from "@/components/admin/AdminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plus, Trash2, ArrowLeft, Save, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAutoBackup } from "@/hooks/useAutoBackup";

interface ProjectExample {
  title: string;
  image?: string;
}

interface Module {
  title: string;
  lessons: string[];
  result: string;
}

interface DetailContent {
  longDescription?: string;
  age?: string;
  level?: string;
  duration?: string;
  tags?: string[];
  topics?: string[];
  projectExamples?: ProjectExample[];
  modules?: Module[];
  sectionsVisibility?: {
    longDescription?: boolean;
    topics?: boolean;
    projectExamples?: boolean;
    modules?: boolean;
    howItWorks?: boolean;
  };
  seo?: {
    title?: string;
    description?: string;
    keywords?: string;
  };
}

interface CourseRow {
  id: string;
  title: string;
  slug: string;
  emoji: string;
  detail_content: DetailContent | null;
}

export default function AdminCourseContent() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const { createCourseSnapshot } = useAutoBackup();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [content, setContent] = useState<DetailContent>({});

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate("/admin/login");
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (!courseId) return;
    (async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, slug, emoji, detail_content")
        .eq("id", courseId)
        .maybeSingle();
      if (error || !data) {
        toast.error("Corso non trovato");
        navigate("/admin/corsi");
        return;
      }
      setCourse(data as CourseRow);
      setContent((data.detail_content as DetailContent) || {});
      setLoading(false);
    })();
  }, [courseId, navigate]);

  const update = <K extends keyof DetailContent>(key: K, value: DetailContent[K]) =>
    setContent((c) => ({ ...c, [key]: value }));

  const handleSave = async () => {
    if (!course) return;
    setSaving(true);
    await createCourseSnapshot(course.id, `Auto-backup prima di modifica contenuto pagina "${course.title}"`);
    // Strip empty arrays/strings to keep JSON tidy
    const cleaned: DetailContent = {};
    if (content.longDescription?.trim()) cleaned.longDescription = content.longDescription.trim();
    if (content.age?.trim()) cleaned.age = content.age.trim();
    if (content.level?.trim()) cleaned.level = content.level.trim();
    if (content.duration?.trim()) cleaned.duration = content.duration.trim();
    if (content.tags?.length) cleaned.tags = content.tags.filter((t) => t.trim());
    if (content.topics?.length) cleaned.topics = content.topics.filter((t) => t.trim());
    if (content.projectExamples?.length)
      cleaned.projectExamples = content.projectExamples.filter((p) => p.title.trim());
    if (content.modules?.length)
      cleaned.modules = content.modules
        .filter((m) => m.title.trim() || m.lessons.length || m.result.trim())
        .map((m) => ({
          title: m.title.trim(),
          result: m.result.trim(),
          lessons: m.lessons.filter((l) => l.trim()),
        }));
    if (content.seo) {
      const seo: DetailContent["seo"] = {};
      if (content.seo.title?.trim()) seo.title = content.seo.title.trim();
      if (content.seo.description?.trim()) seo.description = content.seo.description.trim();
      if (content.seo.keywords?.trim()) seo.keywords = content.seo.keywords.trim();
      if (Object.keys(seo).length) cleaned.seo = seo;
    }

    const { error } = await supabase
      .from("courses")
      .update({ detail_content: cleaned as any })
      .eq("id", course.id);

    setSaving(false);
    if (error) {
      toast.error("Errore durante il salvataggio");
      return;
    }
    toast.success("Contenuti salvati con successo");
    setContent(cleaned);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) return null;

  const renderStringList = (
    field: "tags" | "topics",
    placeholder: string,
    rows?: number,
  ) => {
    const items = content[field] ?? [];
    return (
      <div className="space-y-2">
        {items.map((v, i) => (
          <div key={i} className="flex gap-2">
            {rows ? (
              <Textarea
                rows={rows}
                value={v}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  update(field, next);
                }}
                placeholder={placeholder}
              />
            ) : (
              <Input
                value={v}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  update(field, next);
                }}
                placeholder={placeholder}
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => update(field, items.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update(field, [...items, ""])}
        >
          <Plus className="w-4 h-4 mr-2" /> Aggiungi
        </Button>
      </div>
    );
  };

  const projects = content.projectExamples ?? [];
  const modules = content.modules ?? [];

  const moveModule = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= modules.length) return;
    const next = [...modules];
    [next[i], next[j]] = [next[j], next[i]];
    update("modules", next);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminHeader />
      <AdminNav />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2">
              <Link to="/admin/corsi"><ArrowLeft className="w-4 h-4 mr-1" /> Torna ai corsi</Link>
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <span className="text-3xl">{course.emoji}</span>
              Contenuto pagina: {course.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Modifica tutti i contenuti della pagina pubblica <code>/corsi/{course.slug}</code>.
              I campi vuoti mantengono i contenuti predefiniti.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salva modifiche
          </Button>
        </div>

        {/* Hero info overrides */}
        <Card>
          <CardHeader>
            <CardTitle>Informazioni hero</CardTitle>
            <CardDescription>Sovrascrive i campi mostrati in alto nella pagina del corso.</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Età</Label>
              <Input value={content.age ?? ""} placeholder="es. 8-10 anni" onChange={(e) => update("age", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Livello</Label>
              <Input value={content.level ?? ""} placeholder="es. Principiante" onChange={(e) => update("level", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Durata</Label>
              <Input value={content.duration ?? ""} placeholder="es. 32 lezioni" onChange={(e) => update("duration", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Long description */}
        <Card>
          <CardHeader>
            <CardTitle>Informazioni sul corso</CardTitle>
            <CardDescription>Descrizione lunga mostrata sotto l'hero.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={6}
              value={content.longDescription ?? ""}
              onChange={(e) => update("longDescription", e.target.value)}
              placeholder="Descrivi il corso in dettaglio..."
            />
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Tag</CardTitle>
            <CardDescription>Etichette tematiche del corso.</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStringList("tags", "es. Scratch")}
          </CardContent>
        </Card>

        {/* Topics */}
        <Card>
          <CardHeader>
            <CardTitle>Argomenti trattati</CardTitle>
            <CardDescription>Elenco puntato mostrato nella sezione "Argomenti trattati".</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStringList("topics", "Cosa imparerà l'alunno...", 2)}
          </CardContent>
        </Card>

        {/* Project examples */}
        <Card>
          <CardHeader>
            <CardTitle>Esempi di progetto</CardTitle>
            <CardDescription>Card mostrate nella sezione "Esempi di progetto".</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {projects.map((p, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  value={p.title}
                  placeholder="Titolo progetto"
                  onChange={(e) => {
                    const next = [...projects];
                    next[i] = { ...next[i], title: e.target.value };
                    update("projectExamples", next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => update("projectExamples", projects.filter((_, j) => j !== i))}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => update("projectExamples", [...projects, { title: "" }])}
            >
              <Plus className="w-4 h-4 mr-2" /> Aggiungi progetto
            </Button>
          </CardContent>
        </Card>

        {/* Modules / curriculum */}
        <Card>
          <CardHeader>
            <CardTitle>Curriculum del corso</CardTitle>
            <CardDescription>Moduli con lezioni e risultato atteso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {modules.map((m, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3 bg-background">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-primary">Modulo {i + 1}</span>
                  <div className="ml-auto flex gap-1">
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveModule(i, -1)} disabled={i === 0}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => moveModule(i, 1)} disabled={i === modules.length - 1}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => update("modules", modules.filter((_, j) => j !== i))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Titolo modulo</Label>
                  <Input
                    value={m.title}
                    onChange={(e) => {
                      const next = [...modules];
                      next[i] = { ...next[i], title: e.target.value };
                      update("modules", next);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lezioni</Label>
                  {m.lessons.map((l, j) => (
                    <div key={j} className="flex gap-2">
                      <Input
                        value={l}
                        placeholder={`Lezione ${j + 1}`}
                        onChange={(e) => {
                          const next = [...modules];
                          const lessons = [...next[i].lessons];
                          lessons[j] = e.target.value;
                          next[i] = { ...next[i], lessons };
                          update("modules", next);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = [...modules];
                          next[i] = { ...next[i], lessons: next[i].lessons.filter((_, k) => k !== j) };
                          update("modules", next);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = [...modules];
                      next[i] = { ...next[i], lessons: [...next[i].lessons, ""] };
                      update("modules", next);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Aggiungi lezione
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label>Risultato</Label>
                  <Textarea
                    rows={2}
                    value={m.result}
                    onChange={(e) => {
                      const next = [...modules];
                      next[i] = { ...next[i], result: e.target.value };
                      update("modules", next);
                    }}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => update("modules", [...modules, { title: "", lessons: [], result: "" }])}
            >
              <Plus className="w-4 h-4 mr-2" /> Aggiungi modulo
            </Button>
          </CardContent>
        </Card>

        {/* SEO overrides */}
        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
            <CardDescription>Sovrascrive titolo, meta description e keywords della pagina.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>SEO Title</Label>
              <Input
                value={content.seo?.title ?? ""}
                onChange={(e) => update("seo", { ...content.seo, title: e.target.value })}
                placeholder="Lascia vuoto per usare il default"
              />
            </div>
            <div className="space-y-2">
              <Label>Meta description</Label>
              <Textarea
                rows={3}
                value={content.seo?.description ?? ""}
                onChange={(e) => update("seo", { ...content.seo, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Keywords</Label>
              <Textarea
                rows={2}
                value={content.seo?.keywords ?? ""}
                onChange={(e) => update("seo", { ...content.seo, keywords: e.target.value })}
                placeholder="parole chiave separate da virgole"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salva modifiche
          </Button>
        </div>
      </main>
    </div>
  );
}
