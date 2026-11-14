import { useEffect, useState } from 'react';
import { Code, Download, ExternalLink, FileText, Gamepad2, Image as ImageIcon, Info, Loader2, Music, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CodeViewer } from '@/components/admin/CodeViewer';
import { PythonCompiler } from '@/components/lesson/PythonCompiler';
import { TurtleCompiler } from '@/components/lesson/TurtleCompiler';
import { PgzeroCompiler } from '@/components/lesson/PgzeroCompiler';
import { WebCompiler } from '@/components/lesson/WebCompiler';
import { getSignedUrl, openStorageFile } from '@/hooks/useSignedUrl';
import { useToast } from '@/hooks/use-toast';
import { parseSubmittedCode, parseTestCases } from '@/lib/testCases';
import type { AllegatoGioco } from '@/lib/pgzeroAssets';
import {
  filePreviewKind,
  isTextPreview,
  reviewCompiler,
  scratchEmbedUrl,
  scratchProjectId,
  scratchProjectUrl,
  splitWebCode,
  turbowarpEmbedUrl,
  type FilePreviewKind,
} from '@/lib/submissionPreview';

const BUCKET = 'homework-files';

export interface WorkspaceSubmission {
  id: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  notes: string | null;
}

export interface WorkspaceHomework {
  test_cases: unknown;
  python_env?: string | null;
  default_python_code?: string | null;
  attachments?: unknown;
  /** Slug del corso: decide il compilatore come nella pagina del compito */
  courseSlug?: string | null;
}

/** C'è qualcosa da mostrare nell'area di lavoro (codice, file o link Scratch)? */
function hasWorkspaceContent(submission: WorkspaceSubmission): boolean {
  return (
    parseSubmittedCode(submission.notes) != null ||
    !!submission.file_url ||
    scratchProjectId(submission.notes) != null
  );
}

/**
 * Area di lavoro della valutazione: la consegna come l'ha vista lo studente.
 * Il codice si riapre nel suo compilatore (eseguibile), le immagini, i PDF e i
 * media si vedono senza scaricarli, i progetti Scratch si provano nel player.
 */
export function SubmissionWorkspace({ submission, homework }: { submission: WorkspaceSubmission; homework: WorkspaceHomework }) {
  const compilerCode = parseSubmittedCode(submission.notes);
  const scratchId = scratchProjectId(submission.notes);

  return (
    <div className="space-y-6">
      {compilerCode != null && (
        <section className="space-y-2">
          <Label className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            Codice consegnato dal compilatore
          </Label>
          <ReviewCompiler submissionId={submission.id} code={compilerCode} homework={homework} />
        </section>
      )}

      {submission.file_url && (
        <SubmittedFile key={submission.id} submission={submission} homework={homework} />
      )}

      {scratchId && <ScratchLinkPlayer projectId={scratchId} />}

      {!hasWorkspaceContent(submission) && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nessun codice, file o progetto Scratch in questa consegna.
        </div>
      )}
    </div>
  );
}

function SandboxNote() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      Puoi eseguire e modificare il codice per provarlo: le modifiche non vengono salvate e non cambiano la consegna dello studente.
    </p>
  );
}

/**
 * Lo stesso compilatore usato dallo studente, precompilato con il suo codice.
 * Senza taskId il compilatore non legge né scrive bozze: nulla dello studente cambia.
 */
function ReviewCompiler({ submissionId, code, homework, fileName }: { submissionId: string; code: string; homework: WorkspaceHomework; fileName?: string }) {
  const kind = reviewCompiler(homework.courseSlug, homework, code);
  const testCases = parseTestCases(homework.test_cases);
  const attachments = Array.isArray(homework.attachments) ? (homework.attachments as AllegatoGioco[]) : [];
  const key = `${submissionId}-${fileName ?? 'code'}`;

  let compiler: JSX.Element;
  if (kind === 'web') {
    const web = splitWebCode(code) ?? { html: code, css: '', js: '' };
    compiler = (
      <WebCompiler
        key={key}
        defaultHtmlCode={web.html || '<!-- HTML vuoto -->'}
        defaultCssCode={web.css || '/* nessun CSS */'}
        defaultJsCode={web.js || '// nessun JavaScript'}
        testCases={testCases}
      />
    );
  } else if (kind === 'turtle') {
    compiler = <TurtleCompiler key={key} defaultCode={code} />;
  } else if (kind === 'pgzero') {
    compiler = <PgzeroCompiler key={key} defaultCode={code} attachments={attachments} />;
  } else {
    compiler = <PythonCompiler key={key} defaultCode={code} testCases={testCases} />;
  }

  return (
    <div className="space-y-2">
      <div className="h-[70vh] min-h-[460px] rounded-lg border overflow-hidden bg-card">{compiler}</div>
      <SandboxNote />
    </div>
  );
}

const KIND_LABEL: Record<FilePreviewKind, { label: string; icon: typeof FileText }> = {
  image: { label: 'Immagine consegnata', icon: ImageIcon },
  pdf: { label: 'PDF consegnato', icon: FileText },
  video: { label: 'Video consegnato', icon: Video },
  audio: { label: 'Audio consegnato', icon: Music },
  scratch: { label: 'Progetto Scratch consegnato', icon: Gamepad2 },
  python: { label: 'File Python consegnato', icon: Code },
  html: { label: 'Pagina web consegnata', icon: Code },
  code: { label: 'File di codice consegnato', icon: Code },
  other: { label: 'File consegnato', icon: FileText },
};

function SubmittedFile({ submission, homework }: { submission: WorkspaceSubmission; homework: WorkspaceHomework }) {
  const { toast } = useToast();
  const path = submission.file_url!;
  const kind = filePreviewKind(submission.file_name, submission.file_type);
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (kind === 'other') {
      setStatus('ready');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    (async () => {
      // Bucket privato: link firmato valido un'ora, basta per la valutazione
      const signed = await getSignedUrl(BUCKET, path, 3600);
      if (cancelled) return;
      if (!signed) {
        setStatus('error');
        return;
      }
      setUrl(signed);
      if (isTextPreview(kind)) {
        try {
          const res = await fetch(signed);
          if (!res.ok) throw new Error(String(res.status));
          const content = await res.text();
          if (!cancelled) setText(content);
        } catch {
          if (!cancelled) setStatus('error');
          return;
        }
      }
      if (!cancelled) setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [path, kind]);

  const download = async () => {
    const ok = await openStorageFile(BUCKET, path);
    if (!ok) toast({ title: 'File non disponibile', description: 'Impossibile aprire il file consegnato.', variant: 'destructive' });
  };

  const { label, icon: Icon } = KIND_LABEL[kind];
  const fileName = submission.file_name || 'file';

  let body: JSX.Element | null = null;
  if (status === 'loading') {
    body = (
      <div className="flex items-center justify-center py-12 bg-muted/30 rounded-lg">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  } else if (status === 'error') {
    body = (
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
        Impossibile mostrare l'anteprima del file. Usa il pulsante per scaricarlo.
      </div>
    );
  } else if (kind === 'image' && url) {
    body = (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border bg-muted/30 p-2" title="Apri a dimensione reale" aria-label={`Apri ${fileName} a dimensione reale`}>
        <img src={url} alt={fileName} className="mx-auto max-h-[70vh] w-auto max-w-full object-contain rounded" />
      </a>
    );
  } else if (kind === 'pdf' && url) {
    body = <iframe src={url} title={fileName} className="w-full h-[75vh] rounded-lg border bg-white" />;
  } else if (kind === 'video' && url) {
    body = <video src={url} controls className="w-full max-h-[70vh] rounded-lg border bg-black" />;
  } else if (kind === 'audio' && url) {
    body = <audio src={url} controls className="w-full" />;
  } else if (kind === 'scratch' && url) {
    body = (
      <div className="space-y-2">
        <ScratchFrame src={turbowarpEmbedUrl(url)} title={`Progetto Scratch: ${fileName}`} />
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Il file .sb3 si apre nel player TurboWarp (compatibile con Scratch): clicca sulla bandierina verde per avviarlo.
        </p>
      </div>
    );
  } else if ((kind === 'python' || kind === 'html') && text != null) {
    const code = kind === 'html' ? `<!-- HTML -->\n${text}` : text;
    body = <ReviewCompiler submissionId={submission.id} code={code} homework={homework} fileName={fileName} />;
  } else if (kind === 'code' && text != null) {
    body = <CodeViewer code={text} fileName={fileName} />;
  } else if (kind === 'other') {
    body = (
      <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
        Anteprima non disponibile per questo tipo di file.
      </div>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {label}
        </Label>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="w-4 h-4 mr-1" />
          <span className="max-w-[16rem] truncate">{fileName}</span>
        </Button>
      </div>
      {body}
    </section>
  );
}

function ScratchFrame({ src, title }: { src: string; title: string }) {
  return (
    <div className="mx-auto w-full max-w-[720px]">
      {/* Stage Scratch 480x360 più la barra dei controlli */}
      <div className="relative w-full overflow-hidden rounded-lg border bg-black" style={{ aspectRatio: '485 / 402' }}>
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 w-full h-full"
          allow="autoplay; fullscreen; gamepad; microphone"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function ScratchLinkPlayer({ projectId }: { projectId: string }) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4" />
          Progetto Scratch dal link
        </Label>
        <Button variant="outline" size="sm" asChild>
          <a href={scratchProjectUrl(projectId)} target="_blank" rel="noopener noreferrer" aria-label="Apri il progetto su Scratch">
            <ExternalLink className="w-4 h-4 mr-1" />
            Apri su Scratch
          </a>
        </Button>
      </div>
      <ScratchFrame src={scratchEmbedUrl(projectId)} title={`Progetto Scratch ${projectId}`} />
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Se il gioco non si carica, lo studente non ha ancora condiviso il progetto su Scratch: chiedigli di premere "Condividi".
      </p>
    </section>
  );
}
