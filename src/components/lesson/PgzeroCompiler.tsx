import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Check, Copy, ExternalLink, Loader2, Play, RotateCcw, Save, Square } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCodeDraft } from '@/hooks/useCodeDraft';
import { CodeEditor } from './CodeEditor';
import { FriendlyError } from './FriendlyError';
import { explainPythonError, type FriendlyError as FriendlyErrorData } from '@/lib/friendlyErrors';
import { DEFAULT_REPLIT_URL, toReplitMain } from '@/lib/pgzero';
import { caricaPgzero, eseguiPgzero, fermaPgzero, finestraPgzero } from '@/lib/pgzeroRuntime';
import { caricaLibreria, fileDaCaricare, scaricaFileGioco, type AllegatoGioco } from '@/lib/pgzeroAssets';

interface PgzeroCompilerProps {
  defaultCode?: string;
  replitUrl?: string;
  /**
   * Se presente, il codice dello studente viene salvato (come nel compilatore
   * Python): id del task oppure "homework-<id>" per i compiti.
   */
  taskId?: string;
  /** Immagini e suoni allegati al task o al compito: diventano file del gioco */
  attachments?: AllegatoGioco[];
}

const FALLBACK_CODE = `# Pygame Zero - Gioco semplice

WIDTH = 400
HEIGHT = 300

player_x = 200
player_y = 150
speed = 5

def draw():
    screen.fill("darkblue")
    screen.draw.filled_circle((player_x, player_y), 20, "yellow")
    screen.draw.text("Usa le frecce!", (50, 20), fontsize=20, color="white")

def update():
    global player_x, player_y

    if keyboard.left and player_x > 20:
        player_x -= speed
    if keyboard.right and player_x < WIDTH - 20:
        player_x += speed
    if keyboard.up and player_y > 20:
        player_y -= speed
    if keyboard.down and player_y < HEIGHT - 20:
        player_y += speed`;

const MAX_ZOOM = 2;

export function PgzeroCompiler({ defaultCode, replitUrl, taskId, attachments = [] }: PgzeroCompilerProps) {
  const initial = defaultCode || FALLBACK_CODE;
  const {
    code,
    setCode,
    isLoading: isLoadingDraft,
    isSaving,
    lastSaved,
    resetCode,
    saveDraft,
  } = useCodeDraft({ taskId, codeType: 'python', defaultCode: initial });
  const [output, setOutput] = useState('');
  const [runError, setRunError] = useState<{ error: FriendlyErrorData; code: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [hasFocus, setHasFocus] = useState(false);
  const [copied, setCopied] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    caricaPgzero()
      .then(() => setReady(true))
      .catch((e) => {
        console.error('Errore nel caricamento di Pygame Zero:', e);
        setLoadError(true);
      });
  }, []);

  // La finestra del gioco è una sola per pagina: entra qui e il gioco si ferma quando si esce
  useEffect(() => {
    const canvas = finestraPgzero();
    holderRef.current?.appendChild(canvas);
    const onFocus = () => setHasFocus(true);
    const onBlur = () => setHasFocus(false);
    canvas.addEventListener('focus', onFocus);
    canvas.addEventListener('blur', onBlur);
    return () => {
      fermaPgzero();
      canvas.removeEventListener('focus', onFocus);
      canvas.removeEventListener('blur', onBlur);
      canvas.remove();
    };
  }, []);

  // Il gioco si adatta al pannello (fino al doppio della sua grandezza)
  const fitZoom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return 1;
    const pad = 16;
    return Math.max(0.1, Math.min(MAX_ZOOM, (el.clientWidth - pad) / size.w, (el.clientHeight - pad) / size.h));
  }, [size]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    setZoom(fitZoom());
    const ro = new ResizeObserver(() => setZoom(fitZoom()));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitZoom]);

  useEffect(() => {
    const canvas = finestraPgzero();
    canvas.style.width = `${Math.round(size.w * zoom)}px`;
    canvas.style.height = `${Math.round(size.h * zoom)}px`;
  }, [size, zoom]);

  const run = async () => {
    setOutput('');
    setRunError(null);
    setRunning(true);
    try {
      const file = await scaricaFileGioco(fileDaCaricare(code, await caricaLibreria(), attachments));
      finestraPgzero().focus();
      await eseguiPgzero(code, file, {
        onOutput: (testo) => setOutput((prev) => prev + testo),
        onDimensioni: (w, h) => setSize({ w, h }),
      });
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      const friendly = explainPythonError(message, code);
      if (friendly) setRunError({ error: friendly, code });
      else setOutput((prev) => `${prev}\n❌ ${message}`);
    } finally {
      setRunning(false);
    }
  };

  const stop = () => fermaPgzero();

  const reset = () => {
    stop();
    resetCode();
    setOutput('');
    setRunError(null);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(toReplitMain(code));
      setCopied(true);
      toast({ title: '✅ Codice copiato!', description: 'Ora apri Replit e incollalo in main.py' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Errore', description: 'Non è stato possibile copiare il codice.', variant: 'destructive' });
    }
  };

  const openInReplit = () => {
    window.open(replitUrl || DEFAULT_REPLIT_URL, '_blank');
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-foreground">🎮 Pygame Zero</span>
          {taskId && isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Salvataggio...
            </span>
          )}
          {taskId && !isSaving && lastSaved && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="w-3 h-3 text-green-500" />
              Salvato {lastSaved.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {taskId && (
            <Button size="sm" variant="ghost" onClick={saveDraft} disabled={isSaving || isLoadingDraft} aria-label="Salva codice" title="Salva codice">
              <Save className="w-4 h-4" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={reset} aria-label="Ripristina codice originale" title="Ripristina codice">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={copyCode} aria-label="Copia codice per Replit" title="Copia il codice per incollarlo in Replit (main.py)">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={openInReplit} aria-label="Apri Replit" title="Apri il progetto su Replit">
            <ExternalLink className="w-4 h-4" />
          </Button>
          {running ? (
            <Button size="sm" variant="destructive" onClick={stop}>
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={run} disabled={!ready || isLoadingDraft}>
              {ready ? <Play className="w-4 h-4 mr-1" /> : <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Esegui
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          Errore nel caricamento di Pygame Zero. Ricarica la pagina, oppure usa Replit con i pulsanti in alto.
        </p>
      )}

      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={40} minSize={15}>
          <div className="h-full bg-muted overflow-hidden">
            {isLoadingDraft ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" aria-label="Caricamento del codice salvato" />
              </div>
            ) : (
              <CodeEditor code={code} onChange={setCode} language="python" className="h-full" />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={60} minSize={20}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-1 border-b bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground">Gioco</span>
              <span className="text-xs text-muted-foreground truncate" aria-live="polite">
                {!ready && !loadError
                  ? 'Preparo il gioco… la prima volta ci vuole un po’'
                  : running
                    ? hasFocus ? '🎮 La tastiera comanda il gioco' : 'Clicca sul gioco per usare la tastiera'
                    : ''}
              </span>
            </div>

            <div ref={viewportRef} className="flex-1 min-h-0 overflow-hidden bg-muted/40 flex items-center justify-center">
              <div
                ref={holderRef}
                className="[&>canvas]:block [&>canvas]:bg-black [&>canvas]:shadow-sm [&>canvas]:rounded-sm [&>canvas]:outline-none [&>canvas:focus-visible]:ring-2 [&>canvas:focus-visible]:ring-primary"
              />
            </div>

            {output && (
              <pre
                data-testid="pgzero-output"
                aria-live="polite"
                className="max-h-28 overflow-auto px-4 py-2 text-xs font-mono border-t bg-muted text-foreground whitespace-pre-wrap"
              >
                {output}
              </pre>
            )}
            {runError && (
              <div className="max-h-48 overflow-auto border-t p-2 bg-muted">
                <FriendlyError error={runError.error} code={runError.code} compact />
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
