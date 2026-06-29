import { useMemo, useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useGlossaryTerms, type GlossaryTerm } from "@/hooks/useGlossaryTerms";
import { BookOpen, ExternalLink } from "lucide-react";

interface Props {
  html: string;
  className?: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SKIP_TAGS = new Set(["code", "pre", "a", "script", "style", "h1"]);

function injectGlossaryMarkup(html: string, terms: GlossaryTerm[]): string {
  if (!html || terms.length === 0) return html;
  const usedSlugs = new Set<string>();
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);

  const parts = html.split(/(<[^>]+>)/g);
  const skipStack: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part) continue;

    if (part.startsWith("<")) {
      const closeMatch = part.match(/^<\/([a-zA-Z][a-zA-Z0-9]*)/);
      const openMatch = part.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
      if (closeMatch && skipStack[skipStack.length - 1] === closeMatch[1].toLowerCase()) {
        skipStack.pop();
      } else if (openMatch && !part.endsWith("/>")) {
        const tag = openMatch[1].toLowerCase();
        if (SKIP_TAGS.has(tag)) skipStack.push(tag);
      }
      continue;
    }

    if (skipStack.length > 0) continue;
    let text = part;
    for (const t of sorted) {
      if (usedSlugs.has(t.slug)) continue;
      const re = new RegExp(`\\b(${escapeRegex(t.term)})\\b`, "i");
      if (re.test(text)) {
        text = text.replace(
          re,
          `<span data-glossary="${t.slug}" class="glossary-term cursor-help underline decoration-dotted decoration-primary/60 underline-offset-4 hover:bg-primary/10 rounded px-0.5">$1</span>`
        );
        usedSlugs.add(t.slug);
      }
    }
    parts[i] = text;
  }

  return parts.join("");
}

interface PopupState {
  term: GlossaryTerm;
  x: number;
  y: number;
}

export function GlossaryHTML({ html, className }: Props) {
  const { terms } = useGlossaryTerms();
  const [popup, setPopup] = useState<PopupState | null>(null);

  const { processed, termMap } = useMemo(() => {
    const map = new Map<string, GlossaryTerm>();
    terms.forEach((t) => map.set(t.slug, t));
    const enriched = injectGlossaryMarkup(html, terms);
    const safe = DOMPurify.sanitize(enriched, {
      ADD_ATTR: ["data-glossary", "target", "rel", "allow", "allowfullscreen", "frameborder", "class"],
      ADD_TAGS: ["iframe"],
    });
    return { processed: safe, termMap: map };
  }, [html, terms]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const span = target.closest("[data-glossary]") as HTMLElement | null;
      if (!span) return;
      e.preventDefault();
      e.stopPropagation();
      const slug = span.dataset.glossary!;
      const t = termMap.get(slug);
      if (!t) return;
      const r = span.getBoundingClientRect();
      setPopup({ term: t, x: r.left + r.width / 2, y: r.top + r.height / 2 });
    },
    [termMap]
  );

  useEffect(() => {
    if (!popup) return;
    const onScroll = () => setPopup(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [popup]);

  return (
    <>
      <div
        className={className}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: processed }}
      />
      <Popover open={!!popup} onOpenChange={(o) => !o && setPopup(null)}>
        <PopoverTrigger asChild>
          <span
            aria-hidden
            style={{
              position: "fixed",
              left: popup?.x ?? 0,
              top: popup?.y ?? 0,
              width: 1,
              height: 1,
              pointerEvents: "none",
            }}
          />
        </PopoverTrigger>
        {popup && (
          <PopoverContent className="w-72 z-50" align="center" sideOffset={8}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <h4 className="font-semibold">{popup.term.term}</h4>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-line">
              {popup.term.short_definition || popup.term.definition}
            </p>
            <Link
              to={`/glossario#${popup.term.slug}`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() => setPopup(null)}
            >
              Vai al glossario <ExternalLink className="w-3 h-3" />
            </Link>
          </PopoverContent>
        )}
      </Popover>
    </>
  );
}
