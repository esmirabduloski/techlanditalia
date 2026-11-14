import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { BackButton } from '@/components/ui/back-button';
import { PdfPagesViewer } from '@/components/tutorial/PdfPagesViewer';
import {
  fetchCourseTutorial,
  hasTutorialContent,
  videoEmbedUrl,
  TUTORIAL_BUCKET,
  type CourseTutorial,
} from '@/lib/courseTutorials';
import { FileText, Loader2, PlayCircle } from 'lucide-react';

/** Tutorial "come consegnare i compiti" del corso: video in alto, guida PDF sotto pagina per pagina. */
export default function HomeworkTutorial() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [course, setCourse] = useState<{ title: string; emoji: string | null } | null>(null);
  const [tutorial, setTutorial] = useState<CourseTutorial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !courseId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      supabase.from('courses').select('title, emoji').eq('id', courseId).maybeSingle(),
      fetchCourseTutorial(courseId),
    ]).then(([{ data }, t]) => {
      if (cancelled) return;
      setCourse(data ?? null);
      setTutorial(t);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user, courseId]);

  const { signedUrl: videoFileUrl } = useSignedUrl(TUTORIAL_BUCKET, tutorial?.video_path);
  const { signedUrl: pdfUrl, isLoading: pdfLoading } = useSignedUrl(TUTORIAL_BUCKET, tutorial?.pdf_path);
  const embed = tutorial?.video_url ? videoEmbedUrl(tutorial.video_url) : null;
  const hasVideo = !!(embed || tutorial?.video_path);

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-tech-green-light/20 to-tech-cyan-light/20">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-6">
          <div className="flex items-center gap-4">
            <BackButton onClick={() => navigate(`/area-riservata/corso/${courseId}?tab=compiti`)} aria-label="Indietro ai compiti del corso" />
            <div className="min-w-0">
              {course && (
                <p className="text-sm text-muted-foreground truncate">
                  {course.emoji} {course.title}
                </p>
              )}
              <h1 className="text-xl sm:text-3xl font-bold text-foreground">Come consegnare i compiti</h1>
            </div>
          </div>

          {authLoading || loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !hasTutorialContent(tutorial) ? (
            <p className="rounded-lg border bg-background p-6 text-center text-muted-foreground">
              Il tutorial per questo corso non è ancora disponibile.
            </p>
          ) : (
            <>
              {hasVideo && (
                <section className="space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <PlayCircle className="w-5 h-5 text-primary" /> Guarda il video
                  </h2>
                  <div className="aspect-video w-full overflow-hidden rounded-xl border bg-black shadow-md">
                    {embed ? (
                      <iframe
                        src={embed}
                        title="Video: come consegnare i compiti"
                        className="h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : videoFileUrl ? (
                      <video
                        src={videoFileUrl}
                        controls
                        controlsList="nodownload"
                        playsInline
                        className="h-full w-full"
                        aria-label="Video: come consegnare i compiti"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                </section>
              )}

              {tutorial.pdf_path && (
                <section className="space-y-3">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <FileText className="w-5 h-5 text-primary" /> Leggi la guida
                  </h2>
                  {pdfUrl ? (
                    <PdfPagesViewer url={pdfUrl} title="Guida: come consegnare i compiti" />
                  ) : pdfLoading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                  ) : (
                    <p className="text-sm text-destructive">Non riesco ad aprire la guida. Ricarica la pagina.</p>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
