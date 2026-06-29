import { useMemo } from "react";
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

/**
 * Splits HTML into segments by inserting <span data-glossary="slug">...</span>
 * around the first occurrence of each glossary term, skipping <code>, <pre>,
 * <a>, attribute values and already-tagged glossary spans.
 */
function injectGlossaryMarkup(html: string, terms: GlossaryTerm[]): string {
  if (!html || terms.length === 0) return html;
  const usedSlugs = new Set<string>();
  // Sort longer first to avoid partial matches eating shorter terms
  const sorted = [...terms].sort((a, b) => b.term.length - a.term.length);

  // Process by splitting on tag boundaries so we only touch text nodes.
  const parts = html.split(/(<[^>]+>)/g);

  // Track whether we are inside skip-elements
  const skipStack: string[] = [];
  const SKIP_TAGS = ["code", "pre", "a", "script", "style"];

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
        if (SKIP_TAGS.includes(tag)) skipStack.push(tag);
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
          `<span data-glossary="${t.slug}" class="glossary-term">$1</span>`
        );
        usedSlugs.add(t.slug);
      }
    }
    parts[i] = text;
  }

  return parts.join("");
}

export function GlossaryHTML({ html, className }: Props) {
  const { terms } = useGlossaryTerms();

  const { processed, termMap } = useMemo(() => {
    const map = new Map<string, GlossaryTerm>();
    terms.forEach((t) => map.set(t.slug, t));
    const enriched = injectGlossaryMarkup(html, terms);
    const safe = DOMPurify.sanitize(enriched, {
      ADD_ATTR: ["data-glossary", "target", "rel", "allow", "allowfullscreen", "frameborder"],
      ADD_TAGS: ["iframe"],
    });
    return { processed: safe, termMap: map };
  }, [html, terms]);

  // Render via dangerouslySetInnerHTML then attach popovers using event delegation
  // For simplicity we re-render with React using a manual parser fallback:
  return (
    <GlossaryRenderer html={processed} termMap={termMap} className={className} />
  );
}

interface RendererProps {
  html: string;
  termMap: Map<string, GlossaryTerm>;
  className?: string;
}

function GlossaryRenderer({ html, termMap, className }: RendererProps) {
  // We use a delegated click handler approach: render raw HTML and then
  // overlay popovers by capturing clicks on .glossary-term spans.
  return (
    <div
      className={className}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        const span = target.closest("[data-glossary]") as HTMLElement | null;
        if (!span) return;
        e.preventDefault();
        const slug = span.dataset.glossary!;
        const t = termMap.get(slug);
        if (!t) return;
        // Trigger a centered tooltip-like popup using window.alert fallback only if popover missing.
        // Instead dispatch a custom event handled by GlossaryPopupHost below.
        window.dispatchEvent(
          new CustomEvent("glossary:show", {
            detail: { term: t, anchor: span.getBoundingClientRect() },
          })
        );
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * Mount once near the page root to render a portal-style popover when a
 * glossary term is clicked. Uses Radix Popover anchored to a virtual element.
 */
export function GlossaryPopupHost() {
  return <GlossaryPopupHostImpl />;
}

function GlossaryPopupHostImpl() {
  const { terms } = useGlossaryTerms();
  const map = useMemo(() => {
    const m = new Map<string, GlossaryTerm>();
    terms.forEach((t) => m.set(t.slug, t));
    return m;
  }, [terms]);

  // Lightweight controlled popover
  const [state, setState] = useStateGlossary();

  if (!state) return null;
  const term = state.term;

  return (
    <Popover open onOpenChange={(o) => !o && setState(null)}>
      <PopoverTrigger asChild>
        <span
          style={{
            position: "fixed",
            left: state.anchor.left + state.anchor.width / 2,
            top: state.anchor.top + state.anchor.height / 2,
            width: 1,
            height: 1,
            pointerEvents: "none",
          }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-72" align="center" sideOffset={8}>
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <h4 className="font-semibold">{term.term}</h4>
        </div>
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {term.short_definition || term.definition}
        </p>
        <Link
          to={`/glossario#${term.slug}`}
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          onClick={() => setState(null)}
        >
          Vai al glossario <ExternalLink className="w-3 h-3" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}

// Tiny store using a module-scoped listener for cross-component popups
type PopupState = { term: GlossaryTerm; anchor: DOMRect } | null;

function useStateGlossary(): [PopupState, (s: PopupState) => void] {
  const [, force] = useState(0);
  const ref = (useStateGlossary as any)._ref || { current: null as PopupState };
  (useStateGlossary as any)._ref = ref;

  // Subscribe once
  if (!(useStateGlossary as any)._sub) {
    (useStateGlossary as any)._sub = true;
    if (typeof window !== "undefined") {
      window.addEventListener("glossary:show", (e: any) => {
        ref.current = e.detail;
        (useStateGlossary as any)._listeners?.forEach((fn: any) => fn());
      });
    }
  }

  if (!(useStateGlossary as any)._listeners) {
    (useStateGlossary as any)._listeners = new Set();
  }

  // register listener for this hook instance
  useMemoOnce(() => {
    const fn = () => force((n) => n + 1);
    (useStateGlossary as any)._listeners.add(fn);
    return () => (useStateGlossary as any)._listeners.delete(fn);
  });

  const set = (s: PopupState) => {
    ref.current = s;
    (useStateGlossary as any)._listeners.forEach((fn: any) => fn());
  };
  return [ref.current, set];
}

// Replacement for useEffect to avoid extra import
import { useEffect, useState } from "react";
function useMemoOnce(fn: () => void | (() => void)) {
  useEffect(fn, []);
}
