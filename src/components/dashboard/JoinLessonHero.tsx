import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Video } from "lucide-react";
import { isToday } from "date-fns";

interface TodayLesson {
  id: string;
  lesson_number: number;
  lesson_time: string | null;
  group: {
    title: string;
    lesson_time: string | null;
    student_meeting_link: string | null;
    course: { emoji: string; title: string };
  };
}

interface JoinLessonHeroProps {
  studentId: string;
}

function getLessonLabel(n: number) {
  return `Lezione ${n}`;
}

export function JoinLessonHero({ studentId }: JoinLessonHeroProps) {
  const [lessons, setLessons] = useState<TodayLesson[]>([]);

  useEffect(() => {
    if (!studentId) return;
    (async () => {
      const { data: gs } = await supabase
        .from("group_students")
        .select("group_id")
        .eq("student_id", studentId);
      const groupIds = gs?.map((g) => g.group_id) || [];
      if (groupIds.length === 0) return;

      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data } = await supabase
        .from("group_lesson_schedule")
        .select(`
          id, lesson_number, lesson_date, lesson_time,
          group:group_id (
            title, lesson_time, student_meeting_link,
            course:course_id ( emoji, title )
          )
        `)
        .in("group_id", groupIds)
        .gte("lesson_date", start)
        .lt("lesson_date", end);

      const todays = (data || []).filter((l: any) => isToday(new Date(l.lesson_date)));
      setLessons(todays as any);
    })();
  }, [studentId]);

  if (lessons.length === 0) return null;

  return (
    <div className="mb-8 space-y-3">
      {lessons.map((lesson) => {
        const time = lesson.lesson_time || lesson.group.lesson_time;
        const label = getLessonLabel(lesson.lesson_number);
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
                {lesson.group.course.emoji} {label}
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
            {lesson.group.course.emoji} {label} — Link non disponibile
          </div>
        );
      })}
    </div>
  );
}
