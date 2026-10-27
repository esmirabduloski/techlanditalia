import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Video } from "lucide-react";
import { localDateKey } from "@/lib/childProgress";
import { fetchChildIds } from "@/lib/familyClient";

interface ScheduleRow {
  id: string;
  group_id: string;
  lesson_number: number;
  lesson_time: string | null;
  group: {
    lesson_time: string | null;
    student_meeting_link: string | null;
    course: { emoji: string; title: string };
  };
}

interface TodayLesson extends ScheduleRow {
  /** Nomi dei figli iscritti al gruppo: solo nell'area genitore. */
  names: string[];
}

interface JoinLessonHeroProps {
  userId: string;
  /** Area genitore: le lezioni di oggi di tutti i figli, con il nome di chi entra. */
  forParent?: boolean;
}

function getLessonLabel(n: number) {
  return `Lezione ${n}`;
}

/** "Luca", "Luca e Giulia", "Luca, Giulia e Marco" */
function joinNames(names: string[]) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}` : names[0] ?? "";
}

/**
 * Il pulsante grande «Entra a lezione» in cima all'area riservata, il giorno della lezione.
 * C'è anche nell'area genitore: i più piccoli si collegano spesso dal computer o dal
 * telefono di mamma o papà. Due fratelli nello stesso gruppo hanno un pulsante solo.
 */
export function JoinLessonHero({ userId, forParent = false }: JoinLessonHeroProps) {
  // lesson_date è una DATE: si confronta con la data locale, non con un timestamp UTC
  const today = localDateKey();

  const { data: lessons = [] } = useQuery({
    queryKey: ["join-lesson-hero", userId, forParent, today],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<TodayLesson[]> => {
      let students = [{ id: userId, name: "" }];
      if (forParent) {
        const childIds = await fetchChildIds(supabase, userId);
        const { data, error } = await supabase.from("profiles").select("id, full_name").in("id", childIds);
        if (error) throw error;
        students = (data || []).map((c) => ({ id: c.id, name: c.full_name.split(" ")[0] }));
      }
      if (students.length === 0) return [];

      const { data: gs, error: gsError } = await supabase
        .from("group_students")
        .select("group_id, student_id")
        .in("student_id", students.map((s) => s.id));
      if (gsError) throw gsError;
      const namesByGroup = new Map<string, string[]>();
      for (const row of gs || []) {
        const name = students.find((s) => s.id === row.student_id)?.name;
        namesByGroup.set(row.group_id, [...(namesByGroup.get(row.group_id) || []), ...(name ? [name] : [])]);
      }
      if (namesByGroup.size === 0) return [];

      const { data, error } = await supabase
        .from("group_lesson_schedule")
        .select(`
          id, group_id, lesson_number, lesson_time,
          group:group_id (
            lesson_time, student_meeting_link,
            course:course_id ( emoji, title )
          )
        `)
        .in("group_id", [...namesByGroup.keys()])
        .eq("lesson_date", today);
      if (error) throw error;

      const time = (l: ScheduleRow) => l.lesson_time || l.group.lesson_time || "";
      return ((data || []) as unknown as ScheduleRow[])
        .map((l) => ({ ...l, names: namesByGroup.get(l.group_id) || [] }))
        .sort((a, b) => time(a).localeCompare(time(b)));
    },
  });

  if (lessons.length === 0) return null;

  return (
    <div className="mb-8 space-y-3">
      {lessons.map((lesson) => {
        const time = lesson.lesson_time || lesson.group.lesson_time;
        const label = getLessonLabel(lesson.lesson_number);
        const who = lesson.names.length > 0 ? `${joinNames(lesson.names)} · ` : "";
        return lesson.group.student_meeting_link ? (
          <a
            key={lesson.id}
            href={lesson.group.student_meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full px-8 py-6 rounded-2xl bg-primary text-primary-foreground font-extrabold text-2xl md:text-3xl shadow-tech-glow hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300 text-center animate-pulse-slow"
          >
            <Video className="w-8 h-8 md:w-10 md:h-10" />
            <span>
              🚀 ENTRA A LEZIONE
              <span className="block text-base md:text-lg font-semibold opacity-90 mt-1">
                {who}{lesson.group.course.emoji} {label}
                {time && <> · ore {time.substring(0, 5)}</>}
              </span>
            </span>
          </a>
        ) : (
          <div
            key={lesson.id}
            className="flex items-center justify-center gap-3 w-full px-8 py-6 rounded-2xl bg-muted border-2 border-dashed border-border text-muted-foreground font-bold text-xl text-center"
          >
            <Video className="w-7 h-7" />
            {who}{lesson.group.course.emoji} {label} — Link non disponibile
          </div>
        );
      })}
    </div>
  );
}
