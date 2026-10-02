import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { Play, RotateCcw, Square, Loader2, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { CodeEditor } from './CodeEditor';

interface TurtleCompilerProps {
  defaultCode?: string;
}

const FALLBACK_CODE = `import turtle

t = turtle.Turtle()
t.color("blue")
t.pensize(2)

for _ in range(4):
    t.forward(100)
    t.right(90)

turtle.done()`;

// Fixed logical drawing area (like Trinket): origin (0,0) at the center.
const CANVAS_W = 800;
const CANVAS_H = 600;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

const SKULPT_URLS = [
  'https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js',
  'https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js',
];

let skulptPromise: Promise<void> | null = null;
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Impossibile caricare ${src}`));
    document.head.appendChild(s);
  });
}
function loadSkulpt() {
  if ((window as any).Sk?.builtinFiles) return Promise.resolve();
  if (!skulptPromise) {
    skulptPromise = loadScript(SKULPT_URLS[0])
      .then(() => loadScript(SKULPT_URLS[1]))
      .catch((e) => {
        skulptPromise = null;
        throw e;
      });
  }
  return skulptPromise;
}

const clamp = (v: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v));

export function TurtleCompiler({ defaultCode }: TurtleCompilerProps) {
  const initial = defaultCode || FALLBACK_CODE;
  const [code, setCode] = useState(initial);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [autoFit, setAutoFit] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);

  useEffect(() => setCode(initial), [initial]);

  useEffect(() => {
    loadSkulpt()
      .then(() => setReady(true))
      .catch((e) => setLoadError(e.message));
  }, []);

  const fitZoom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return 1;
    const pad = 16;
    return clamp(Math.min((el.clientWidth - pad) / CANVAS_W, (el.clientHeight - pad) / CANVAS_H));
  }, []);

  // Keep the drawing fitted to the panel while auto-fit is on
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (autoFit) setZoom(fitZoom());
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFit, fitZoom]);

  // Ctrl/⌘ + wheel or trackpad pinch to zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      setAutoFit(false);
      setZoom((z) => clamp(z * Math.exp(-dy * 0.002)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (f: number) => {
    setAutoFit(false);
    setZoom((z) => clamp(z * f));
  };
  const fit = () => {
    setAutoFit(true);
    setZoom(fitZoom());
  };

  const run = async () => {
    const Sk = (window as any).Sk;
    if (!Sk || !targetRef.current) return;
    targetRef.current.innerHTML = '';
    setOutput('');
    stopRef.current = false;
    setRunning(true);

    Sk.configure({
      output: (text: string) => setOutput((prev) => prev + text),
      read: (x: string) => {
        if (!Sk.builtinFiles || !Sk.builtinFiles.files[x]) {
          throw new Error(`File non trovato: '${x}'`);
        }
        return Sk.builtinFiles.files[x];
      },
      inputfun: (prompt: string) => window.prompt(prompt) ?? '',
      inputfunTakesPrompt: true,
      __future__: Sk.python3,
      killableWhile: true,
      killableFor: true,
    });
    Sk.TurtleGraphics = { target: targetRef.current, width: CANVAS_W, height: CANVAS_H };

    try {
      await Sk.misceval.asyncToPromise(
        () => Sk.importMainWithBody('<stdin>', false, code, true),
        {
          '*': () => {
            if (stopRef.current) throw new Error('Esecuzione interrotta');
          },
        },
      );
    } catch (err: any) {
      setOutput((prev) => prev + '\n❌ ' + (err?.toString?.() ?? String(err)));
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    stopRef.current = true;
  };

  const reset = () => {
    stop();
    setCode(initial);
    setOutput('');
    if (targetRef.current) targetRef.current.innerHTML = '';
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-muted/50">
        <span className="text-sm font-medium text-foreground">🐢 Python Turtle</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            aria-label="Ripristina codice originale"
            title="Ripristina codice"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          {running ? (
            <Button size="sm" variant="destructive" onClick={stop}>
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={run} disabled={!ready}>
              {ready ? <Play className="w-4 h-4 mr-1" /> : <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Esegui
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          Errore nel caricamento del compilatore. Ricarica la pagina.
        </p>
      )}

      <ResizablePanelGroup direction="vertical" className="flex-1">
        <ResizablePanel defaultSize={40} minSize={15}>
          <div className="h-full bg-muted overflow-hidden">
            <CodeEditor code={code} onChange={setCode} language="python" className="h-full" />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={60} minSize={20}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-1 border-b bg-muted/50">
              <span className="text-xs font-medium text-muted-foreground">Disegno</span>
              <div className="flex items-center gap-1" role="group" aria-label="Zoom del disegno">
                <Button size="sm" variant="ghost" onClick={() => zoomBy(1 / 1.25)} aria-label="Rimpicciolisci">
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs tabular-nums w-12 text-center text-muted-foreground" aria-live="polite">
                  {Math.round(zoom * 100)}%
                </span>
                <Button size="sm" variant="ghost" onClick={() => zoomBy(1.25)} aria-label="Ingrandisci">
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={fit} aria-label="Adatta alla finestra" title="Adatta">
                  <Maximize className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div ref={viewportRef} className="flex-1 min-h-0 overflow-auto bg-muted/40">
              <div
                className="mx-auto my-2"
                style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}
              >
                <div
                  ref={targetRef}
                  aria-label="Area di disegno della tartaruga"
                  className="relative bg-white shadow-sm rounded-sm overflow-hidden [&_canvas]:!absolute [&_canvas]:left-0 [&_canvas]:top-0"
                  style={{
                    width: CANVAS_W,
                    height: CANVAS_H,
                    transform: `scale(${zoom})`,
                    transformOrigin: '0 0',
                  }}
                />
              </div>
            </div>

            {output && (
              <pre
                aria-live="polite"
                className="max-h-28 overflow-auto px-4 py-2 text-xs font-mono border-t bg-muted text-foreground whitespace-pre-wrap"
              >
                {output}
              </pre>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
