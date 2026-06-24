import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBookmarks } from '@/hooks/useBookmarks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookmarkButton } from './BookmarkButton';
import { Bookmark, BookOpen, Puzzle, Loader2, ArrowDownAZ, Clock } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface EnrichedBookmark {
  id: string;
  entity_type: 'lesson' | 'task';
  entity_id: string;
  course_id: string | null;
  title: string;
  subtitle: string;
  courseEmoji: string;
  courseSlug: string;
  courseTitle: string;
  lessonNumber: number;
  taskNumber?: number;
  created_at: string;
}

type SortMode = 'date' | 'course';

export function BookmarksSection() {
  const { bookmarks, isLoading, isBookmarked, toggleBookmark } = useBookmarks();
  const [enriched, setEnriched] = useState<EnrichedBookmark[]>([]);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('date');

  useEffect(() => {
    if (bookmarks.length === 0) { setEnriched([]); return; }
    enrichBookmarks();
  }, [bookmarks]);

  const enrichBookmarks = async () => {
    setEnrichLoading(true);
    const result: EnrichedBookmark[] = [];

    const lessonBookmarks = bookmarks.filter(b => b.entity_type === 'lesson');
    const taskBookmarks = bookmarks.filter(b => b.entity_type === 'task');

    if (lessonBookmarks.length > 0) {
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, title, lesson_number, course_id, courses!inner(title, emoji, slug)')
        .in('id', lessonBookmarks.map(b => b.entity_id));

      if (lessons) {
        lessons.forEach((l: any) => {
          const bm = lessonBookmarks.find(b => b.entity_id === l.id);
          if (bm) {
            result.push({
              id: bm.id,
              entity_type: 'lesson',
              entity_id: l.id,
              course_id: l.course_id,
              title: l.title,
              subtitle: `Lezione ${l.lesson_number}`,
              courseEmoji: l.courses.emoji,
              courseSlug: l.courses.slug,
              courseTitle: l.courses.title,
              lessonNumber: l.lesson_number,
              created_at: bm.created_at,
            });
          }
        });
      }
    }

    if (taskBookmarks.length > 0) {
      const { data: tasks } = await supabase
        .from('lesson_tasks')
        .select('id, title, task_number, lesson_id, lessons!inner(lesson_number, course_id, courses!inner(title, emoji, slug))')
        .in('id', taskBookmarks.map(b => b.entity_id));

      if (tasks) {
        tasks.forEach((t: any) => {
          const bm = taskBookmarks.find(b => b.entity_id === t.id);
          if (bm) {
            result.push({
              id: bm.id,
              entity_type: 'task',
              entity_id: t.id,
              course_id: t.lessons.course_id,
              title: t.title,
              subtitle: `Lezione ${t.lessons.lesson_number} • Task ${t.task_number}`,
              courseEmoji: t.lessons.courses.emoji,
              courseSlug: t.lessons.courses.slug,
              courseTitle: t.lessons.courses.title,
              lessonNumber: t.lessons.lesson_number,
              taskNumber: t.task_number,
              created_at: bm.created_at,
            });
          }
        });
      }
    }

    setEnriched(result);
    setEnrichLoading(false);
  };

  const sorted = useMemo(() => {
    const items = [...enriched];
    if (sortMode === 'date') {
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      items.sort((a, b) => {
        const cmp = a.courseTitle.localeCompare(b.courseTitle);
        if (cmp !== 0) return cmp;
        if (a.lessonNumber !== b.lessonNumber) return a.lessonNumber - b.lessonNumber;
        return (a.taskNumber ?? 0) - (b.taskNumber ?? 0);
      });
    }
    return items;
  }, [enriched, sortMode]);

  if (isLoading || enrichLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (enriched.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" />
            I Tuoi Preferiti
          </CardTitle>
          <Tabs value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
            <TabsList className="h-8">
              <TabsTrigger value="date" className="text-xs gap-1 px-2 h-7">
                <Clock className="w-3 h-3" /> Data
              </TabsTrigger>
              <TabsTrigger value="course" className="text-xs gap-1 px-2 h-7">
                <ArrowDownAZ className="w-3 h-3" /> Corso
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sorted.map(item => {
            const href = item.entity_type === 'lesson'
              ? `/area-riservata/corso/${item.course_id}/lezione/${item.lessonNumber}`
              : `/area-riservata/corso/${item.course_id}/lezione/${item.lessonNumber}/task/${item.taskNumber}`;

            return (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group">
                <span className="text-lg">{item.courseEmoji}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  {item.entity_type === 'lesson' ? (
                    <BookOpen className="w-4 h-4" />
                  ) : (
                    <Puzzle className="w-4 h-4" />
                  )}
                </div>
                <Link to={href} className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                </Link>
                <BookmarkButton
                  isBookmarked={true}
                  onToggle={() => toggleBookmark(item.entity_type, item.entity_id, item.course_id || undefined)}
                  size="sm"
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}