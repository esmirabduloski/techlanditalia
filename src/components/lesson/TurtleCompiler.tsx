import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Play, RotateCcw, Square, Loader2 } from 'lucide-react';

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

export function TurtleCompiler({ defaultCode }: TurtleCompilerProps) {
  const initial = defaultCode || FALLBACK_CODE;
  const [code, setCode] = useState(initial);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    setCode(initial);
  }, [initial]);

  useEffect(() => {
    loadSkulpt()
      .then(() => setReady(true))
      .catch((e) => setLoadError(e.message));
  }, []);

  const run = async () => {
    const Sk = (window as any).Sk;
    if (!Sk || !canvasRef.current) return;
    canvasRef.current.innerHTML = '';
    setOutput('');
    stopRef.current = false;
    setRunning(true);
    const width = Math.max(300, canvasRef.current.clientWidth - 4);
    const height = Math.max(300, canvasRef.current.clientHeight - 4);

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
    (Sk.TurtleGraphics ||= {}).target = canvasRef.current;
    Sk.TurtleGraphics.width = width;
    Sk.TurtleGraphics.height = height;

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
    if (canvasRef.current) canvasRef.current.innerHTML = '';
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background">
        <div>
          <h3 className="font-semibold">🐢 Python Turtle</h3>
          <p className="text-sm text-muted-foreground">Scrivi il codice e premi Esegui</p>
        </div>
        <div className="flex items-center gap-2">
          {running ? (
            <Button size="sm" variant="destructive" onClick={stop} className="min-h-[44px]">
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={run} disabled={!ready} className="min-h-[44px]">
              {ready ? <Play className="w-4 h-4 mr-1" /> : <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Esegui
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={reset}
            aria-label="Ripristina codice originale"
            className="min-h-[44px] min-w-[44px]"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">
          Errore nel caricamento del compilatore. Ricarica la pagina.
        </p>
      )}

      <div className="flex-1 min-h-0 flex flex-col">
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          aria-label="Codice Python"
          className="font-mono text-sm min-h-[180px] h-[35%] resize-none rounded-none border-0 border-b"
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const el = e.currentTarget;
              const { selectionStart: s, selectionEnd: en } = el;
              const next = code.slice(0, s) + '    ' + code.slice(en);
              setCode(next);
              requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
            }
          }}
        />
        <div
          ref={canvasRef}
          className="flex-1 min-h-[300px] bg-background overflow-hidden flex items-center justify-center [&_canvas]:bg-white"
          aria-label="Area di disegno della tartaruga"
        />
        {output && (
          <pre
            aria-live="polite"
            className="max-h-32 overflow-auto px-4 py-2 text-xs font-mono border-t bg-muted text-foreground whitespace-pre-wrap"
          >
            {output}
          </pre>
        )}
      </div>
    </div>
  );
}
