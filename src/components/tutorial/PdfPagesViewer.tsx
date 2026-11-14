import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Loader2 } from 'lucide-react';

/**
 * Mostra un PDF pagina per pagina dentro la pagina (niente download né lettore del browser).
 * pdf.js si carica solo qui; build "legacy" per i tablet e i browser meno recenti.
 * Ogni pagina si disegna quando arriva vicino allo schermo.
 */
async function loadPdfJs() {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export function PdfPagesViewer({ url, title }: { url: string; title: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let loaded: PDFDocumentProxy | null = null;
    setDoc(null);
    setError(false);
    loadPdfJs()
      .then((pdfjs) => pdfjs.getDocument({ url, isEvalSupported: false }).promise)
      .then((pdf) => {
        loaded = pdf;
        if (cancelled) void pdf.destroy();
        else setDoc(pdf);
      })
      .catch((e) => {
        console.error('PDF non caricato:', e);
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (loaded) void loaded.destroy();
    };
  }, [url]);

  if (error) {
    return (
      <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Non riesco a mostrare la guida. Ricarica la pagina; se non va ancora, avvisa il tuo insegnante.
      </p>
    );
  }
  if (!doc) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border bg-muted/30 p-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Caricamento della guida…
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-label={title}>
      {Array.from({ length: doc.numPages }, (_, i) => (
        <PdfPage key={i} doc={doc} pageNumber={i + 1} total={doc.numPages} />
      ))}
    </div>
  );
}

function PdfPage({ doc, pageNumber, total }: { doc: PDFDocumentProxy; pageNumber: number; total: number }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber <= 2);
  const [width, setWidth] = useState(0);
  const [ratio, setRatio] = useState(1.414); // A4 verticale finché non si conosce la pagina
  const [rendered, setRendered] = useState(false);

  // Disegna solo quando la pagina si avvicina allo schermo
  useEffect(() => {
    const el = wrapper.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) setVisible(true); },
      { rootMargin: '800px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  // Larghezza disponibile (si ridisegna se cambia, es. telefono ruotato)
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const update = () => setWidth(Math.round(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !width || !canvas.current) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    doc.getPage(pageNumber).then((page) => {
      if (cancelled || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      const ctx = c.getContext('2d');
      if (!ctx) return;
      task = page.render({ canvasContext: ctx, viewport });
      task.promise.then(() => { if (!cancelled) setRendered(true); }).catch(() => { /* annullato */ });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, visible, width]);

  return (
    <figure className="space-y-2">
      <div
        ref={wrapper}
        className="relative w-full overflow-hidden rounded-lg border bg-white shadow-sm"
        style={{ aspectRatio: `1 / ${ratio}` }}
      >
        <canvas
          ref={canvas}
          className="block h-full w-full"
          role="img"
          aria-label={`Pagina ${pageNumber} di ${total}`}
          onContextMenu={(e) => e.preventDefault()}
        />
        {!rendered && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
      <figcaption className="text-center text-sm text-muted-foreground">
        Pagina {pageNumber} di {total}
      </figcaption>
    </figure>
  );
}
