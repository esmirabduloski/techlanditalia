import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { GoogleSlidesEmbed } from './GoogleSlidesEmbed';
import { GlossaryHTML } from '@/components/glossary/GlossaryHTML';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

interface LessonContentProps {
  title: string;
  lessonTitle?: string | null;
  description?: string | null;
  content?: string | null;
  contentType?: string;
  videoUrl?: string | null;
  slidesUrl?: string | null;
  images?: string[];
  /** Nasconde titolo e titolo lezione quando sono già mostrati da LessonHeader */
  hideHeading?: boolean;
}

// Un blockquote che inizia con una di queste emoji diventa un riquadro colorato
const CALLOUTS: Array<[string, string]> = [
  ['💡', 'callout-tip'],
  ['⚠', 'callout-warning'],
  ['❗', 'callout-warning'],
  ['🎯', 'callout-goal'],
  ['ℹ', 'callout-info'],
  ['📌', 'callout-info'],
];

/**
 * Arricchisce l'HTML della lezione dopo il render: riquadri, pulsante "Copia" sui
 * blocchi di codice. Idempotente, perché GlossaryHTML può ri-renderizzare l'HTML.
 */
function enhanceContent(root: HTMLElement) {
  root.querySelectorAll('blockquote:not([data-enhanced])').forEach(quote => {
    quote.setAttribute('data-enhanced', '');
    const text = (quote.textContent || '').trim();
    const callout = CALLOUTS.find(([emoji]) => text.startsWith(emoji));
    if (callout) quote.classList.add(callout[1]);
  });

  root.querySelectorAll('pre:not([data-enhanced])').forEach(pre => {
    pre.setAttribute('data-enhanced', '');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy-btn';
    button.textContent = 'Copia';
    button.setAttribute('aria-label', 'Copia codice');
    pre.appendChild(button);
  });
}

/** Copia negli appunti, con ripiego su execCommand dove la Clipboard API è bloccata. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    textarea.remove();
    return ok;
  }
}

export function LessonContent({
  title,
  lessonTitle,
  description,
  content,
  contentType = 'text',
  videoUrl,
  slidesUrl,
  images = [],
  hideHeading = false,
}: LessonContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoomedImage, setZoomedImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    enhanceContent(root);
    const observer = new MutationObserver(() => enhanceContent(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [content]);

  const handleContentClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    const copyButton = target.closest('.code-copy-btn') as HTMLButtonElement | null;
    if (copyButton) {
      const pre = copyButton.closest('pre');
      if (!pre) return;
      const clone = pre.cloneNode(true) as HTMLElement;
      clone.querySelector('.code-copy-btn')?.remove();
      copyText(clone.textContent ?? '').then(ok => {
        copyButton.textContent = ok ? 'Copiato ✓' : 'Non copiato';
        copyButton.dataset.copied = 'true';
        setTimeout(() => {
          copyButton.textContent = 'Copia';
          delete copyButton.dataset.copied;
        }, 1500);
      });
      return;
    }

    if (target instanceof HTMLImageElement && !target.closest('a')) {
      setZoomedImage({ src: target.src, alt: target.alt });
    }
  };

  const getVideoEmbedUrl = (url: string): string => {
    // YouTube
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (youtubeMatch) {
      // Modalità privacy-enhanced: nessun cookie YouTube finché il video non viene avviato
      return `https://www.youtube-nocookie.com/embed/${youtubeMatch[1]}`;
    }

    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    }

    return url;
  };

  const renderContent = () => {
    return (
      <div className="space-y-6">
        {/* Text Content with glossary tooltips */}
        {content && (
          <div ref={contentRef} onClick={handleContentClick}>
            <GlossaryHTML html={content} className="lesson-prose" />
          </div>
        )}


        {/* Video */}
        {videoUrl && (
          <div className="aspect-video w-full rounded-lg overflow-hidden border border-border shadow-md">
            <iframe
              src={getVideoEmbedUrl(videoUrl)}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video"
            />
          </div>
        )}

        {/* Google Slides */}
        {slidesUrl && (
          <GoogleSlidesEmbed url={slidesUrl} />
        )}

        {/* Images */}
        {images.length > 0 && (
          <div className="grid gap-4">
            {images.map((imageUrl, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setZoomedImage({ src: imageUrl, alt: `Immagine ${index + 1}` })}
                className="block w-full cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Ingrandisci immagine ${index + 1}`}
              >
                <img
                  src={imageUrl}
                  alt={`Immagine ${index + 1}`}
                  className="w-full rounded-lg border border-border shadow-sm"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6">
      {/* Lesson Title */}
      {!hideHeading && lessonTitle && (
        <p className="text-sm font-medium text-muted-foreground mb-1">
          📖 {lessonTitle}
        </p>
      )}

      {/* Title */}
      {!hideHeading && (
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
          {title}
        </h1>
      )}

      {/* Description */}
      {description && (
        <p className="text-muted-foreground mb-6">{description}</p>
      )}

      {/* Main Content */}
      {renderContent()}

      <Dialog open={!!zoomedImage} onOpenChange={open => !open && setZoomedImage(null)}>
        <DialogContent className="max-w-[95vw] w-auto p-2 sm:p-3">
          <DialogTitle className="sr-only">{zoomedImage?.alt || 'Immagine ingrandita'}</DialogTitle>
          {zoomedImage && (
            <figure>
              <img
                src={zoomedImage.src}
                alt={zoomedImage.alt}
                className="max-h-[85vh] max-w-full mx-auto rounded-md object-contain"
              />
              {zoomedImage.alt && !/^Immagine \d+$/.test(zoomedImage.alt) && (
                <figcaption className="mt-2 text-center text-sm text-muted-foreground">{zoomedImage.alt}</figcaption>
              )}
            </figure>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
