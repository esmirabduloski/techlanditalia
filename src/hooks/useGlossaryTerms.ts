import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GlossaryTerm {
  id: string;
  term: string;
  slug: string;
  definition: string;
  short_definition: string | null;
  category: string;
}

let cache: GlossaryTerm[] | null = null;
let inflight: Promise<GlossaryTerm[]> | null = null;

export function useGlossaryTerms() {
  const [terms, setTerms] = useState<GlossaryTerm[]>(cache || []);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) {
      setTerms(cache);
      setLoading(false);
      return;
    }
    if (!inflight) {
      inflight = supabase
        .from("glossary_terms")
        .select("id, term, slug, definition, short_definition, category")
        .eq("is_published", true)
        .then(({ data }) => {
          cache = (data || []) as GlossaryTerm[];
          return cache;
        });
    }
    inflight.then((d) => {
      setTerms(d);
      setLoading(false);
    });
  }, []);

  return { terms, loading };
}
