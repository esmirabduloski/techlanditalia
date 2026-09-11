import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CourseOption {
  id: string;
  title: string;
  emoji: string | null;
  slug: string;
}

/** Elenco corsi utilizzabile nei menu a tendina (CRM, form admin). */
export function useCourseOptions() {
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title, emoji, slug")
        .order("title", { ascending: true });
      if (active) {
        setCourses((data ?? []) as CourseOption[]);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return { courses, loading };
}
