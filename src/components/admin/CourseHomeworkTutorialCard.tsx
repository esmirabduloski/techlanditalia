import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import {
  fetchCourseTutorial,
  removeTutorialFiles,
  saveCourseTutorial,
  uploadTutorialFile,
  validateVideoLink,
  videoEmbedUrl,
  TUTORIAL_BUCKET,
  type CourseTutorial,
} from '@/lib/courseTutorials';
import { Eye, FileText, Film, Link2, Loader2, Save, Trash2, Upload } from 'lucide-react';

type Kind = 'video' | 'pdf';

const emptyTutorial = (courseId: string): CourseTutorial => ({
  course_id: courseId, video_url: null, video_path: null, pdf_path: null,
});

const fileName = (path: string | null) => path?.split('/').pop() ?? '';

/** Admin → Corsi → Contenuto: video e guida PDF "come consegnare i compiti" del corso. */
export function CourseHomeworkTutorialCard({ courseId }: { courseId: string }) {
  const [saved, setSaved] = useState<CourseTutorial>(emptyTutorial(courseId));
  const [draft, setDraft] = useState<CourseTutorial>(emptyTutorial(courseId));
  const [videoMode, setVideoMode] = useState<'link' | 'file'>('link');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<Kind | null>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCourseTutorial(courseId).then((t) => {
      if (cancelled) return;
      const current = t ?? emptyTutorial(courseId);
      setSaved(current);
      setDraft(current);
      setVideoMode(current.video_path ? 'file' : 'link');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [courseId]);

  const { signedUrl: videoFileUrl } = useSignedUrl(TUTORIAL_BUCKET, draft.video_path);
  const linkError = videoMode === 'link' ? validateVideoLink(draft.video_url ?? '') : null;
  const embed = videoMode === 'link' && draft.video_url ? videoEmbedUrl(draft.video_url) : null;
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const pick = async (kind: Kind, file: File | undefined) => {
    if (!file) return;
    setUploading(kind);
    const res = await uploadTutorialFile(courseId, kind, file);
    setUploading(null);
    if ('error' in res) {
      toast.error(res.error);
      return;
    }
    // Un file nuovo non ancora salvato sostituisce l'altro caricato in questa sessione
    const previous = kind === 'pdf' ? draft.pdf_path : draft.video_path;
    const savedPath = kind === 'pdf' ? saved.pdf_path : saved.video_path;
    if (previous && previous !== savedPath) void removeTutorialFiles([previous]);
    setDraft((d) => (kind === 'pdf' ? { ...d, pdf_path: res.path } : { ...d, video_path: res.path }));
    toast.success(`${file.name} caricato: ricordati di salvare`);
  };

  const save = async () => {
    // Il video è quello della scheda scelta: l'altro viene tolto
    const next: CourseTutorial = videoMode === 'link'
      ? { ...draft, video_path: null }
      : { ...draft, video_url: null };
    setSaving(true);
    const error = await saveCourseTutorial(next);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    // File che il tutorial non usa più
    void removeTutorialFiles(
      [saved.video_path, saved.pdf_path, draft.video_path, draft.pdf_path]
        .filter((p) => p && p !== next.video_path && p !== next.pdf_path),
    );
    const normalized = { ...next, video_url: next.video_url?.trim() || null };
    setSaved(normalized);
    setDraft(normalized);
    toast.success(
      normalized.video_url || normalized.video_path || normalized.pdf_path
        ? 'Tutorial salvato: gli studenti del corso lo vedono nella home'
        : 'Tutorial tolto: gli studenti non vedono più il bottone',
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Film className="w-5 h-5 text-primary" />
          Tutorial: come consegnare i compiti
        </CardTitle>
        <CardDescription>
          Video e guida PDF per gli studenti iscritti a questo corso. Nella home, sulla card del corso,
          compare il bottone "Tutorial: come consegnare i compiti" quando c'è almeno il video o il PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Caricamento…
          </div>
        ) : (
          <>
            {/* Video: link oppure file */}
            <div className="space-y-3">
              <Label className="text-base">Video</Label>
              <Tabs value={videoMode} onValueChange={(v) => setVideoMode(v as 'link' | 'file')}>
                <TabsList className="grid w-full grid-cols-2 sm:w-96">
                  <TabsTrigger value="link" className="gap-2"><Link2 className="w-4 h-4" /> Link YouTube/Vimeo</TabsTrigger>
                  <TabsTrigger value="file" className="gap-2"><Upload className="w-4 h-4" /> Carica file</TabsTrigger>
                </TabsList>
                <TabsContent value="link" className="space-y-2">
                  <Input
                    aria-label="Link del video"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={draft.video_url ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, video_url: e.target.value }))}
                  />
                  {linkError && <p className="text-sm text-destructive">{linkError}</p>}
                  <p className="text-xs text-muted-foreground">Va bene anche un video YouTube "non in elenco".</p>
                  {embed && (
                    <div className="aspect-video w-full max-w-md overflow-hidden rounded-lg border">
                      <iframe src={embed} title="Anteprima video" className="h-full w-full" allowFullScreen />
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="file" className="space-y-2">
                  <input
                    ref={videoInput}
                    type="file"
                    accept="video/mp4,video/webm,.mp4,.webm"
                    className="hidden"
                    data-testid="tutorial-video-input"
                    onChange={(e) => { void pick('video', e.target.files?.[0]); e.target.value = ''; }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => videoInput.current?.click()} disabled={uploading !== null}>
                      {uploading === 'video' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      {draft.video_path ? 'Sostituisci video' : 'Carica video (.mp4, .webm)'}
                    </Button>
                    {draft.video_path && (
                      <Button type="button" variant="ghost" className="text-destructive" onClick={() => setDraft((d) => ({ ...d, video_path: null }))}>
                        <Trash2 className="w-4 h-4 mr-1" /> Togli
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Massimo 50 MB. Per video più lunghi usa un link YouTube.</p>
                  {draft.video_path && (
                    <div className="space-y-2">
                      <p className="text-sm">{fileName(draft.video_path)}</p>
                      {videoFileUrl && <video src={videoFileUrl} controls className="w-full max-w-md rounded-lg border" />}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Guida PDF */}
            <div className="space-y-3">
              <Label className="text-base">Guida PDF</Label>
              <input
                ref={pdfInput}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                data-testid="tutorial-pdf-input"
                onChange={(e) => { void pick('pdf', e.target.files?.[0]); e.target.value = ''; }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={() => pdfInput.current?.click()} disabled={uploading !== null}>
                  {uploading === 'pdf' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  {draft.pdf_path ? 'Sostituisci PDF' : 'Carica PDF'}
                </Button>
                {draft.pdf_path && (
                  <>
                    <span className="text-sm">{fileName(draft.pdf_path)}</span>
                    <Button type="button" variant="ghost" className="text-destructive" onClick={() => setDraft((d) => ({ ...d, pdf_path: null }))}>
                      <Trash2 className="w-4 h-4 mr-1" /> Togli
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Gli studenti lo leggono pagina per pagina, senza scaricarlo.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={saving || uploading !== null || !!linkError || !dirty}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salva tutorial
              </Button>
              {(saved.video_url || saved.video_path || saved.pdf_path) && !dirty && (
                <Button variant="outline" asChild>
                  <Link to={`/area-riservata/corso/${courseId}/tutorial-compiti`}>
                    <Eye className="w-4 h-4 mr-2" /> Vedi come lo vede lo studente
                  </Link>
                </Button>
              )}
              {dirty && <span className="text-sm text-muted-foreground">Modifiche non salvate</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
