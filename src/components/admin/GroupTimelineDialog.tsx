import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, CheckCircle2, Circle, Clock, ArrowRight } from "lucide-react";
import { format, parseISO, isToday, isBefore, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface GroupTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupTitle: string;
}

interface ScheduleItem {
  id: string;
  lesson_number: number;
  lesson_date: string;
  lesson_title: string | null;
  lesson_time: string | null;
  has_attendance: boolean;
  present_count: number;
  absent_count: number;
  total_students: number;
}

export function GroupTimelineDialog({
  open, onOpenChange, groupId, groupTitle
}: GroupTimelineDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    if (open && groupId) fetchData();
  }, [open, groupId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: scheduleData } = await supabase
        .from('group_lesson_schedule')
        .select('*')
        .eq('group_id', groupId)
        .order('lesson_number');

      const { data: attendanceData } = await supabase
        .from('group_attendance')
        .select('lesson_number, status')
        .eq('group_id', groupId);

      const { count: totalStudents } = await supabase
        .from('group_students')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupId);

      // Build attendance summary per lesson
      const attendanceMap: Record<number, { present: number; absent: number }> = {};
      (attendanceData || []).forEach(a => {
        if (!attendanceMap[a.lesson_number]) attendanceMap[a.lesson_number] = { present: 0, absent: 0 };
        if (a.status === 'present') attendanceMap[a.lesson_number].present++;
        else if (a.status === 'absent') attendanceMap[a.lesson_number].absent++;
      });

      setSchedule((scheduleData || []).map(s => ({
        id: s.id,
        lesson_number: s.lesson_number,
        lesson_date: s.lesson_date,
        lesson_title: s.lesson_title,
        lesson_time: s.lesson_time,
        has_attendance: !!attendanceMap[s.lesson_number],
        present_count: attendanceMap[s.lesson_number]?.present || 0,
        absent_count: attendanceMap[s.lesson_number]?.absent || 0,
        total_students: totalStudents || 0,
      })));
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatus = (item: ScheduleItem) => {
    const lessonDate = parseISO(item.lesson_date);
    const today = startOfDay(new Date());
    if (item.has_attendance) return 'completed';
    if (isToday(lessonDate)) return 'today';
    if (isBefore(lessonDate, today)) return 'past';
    return 'future';
  };

  const completedCount = schedule.filter(s => s.has_attendance).length;
  const progress = schedule.length > 0 ? Math.round((completedCount / schedule.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Timeline - {groupTitle}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : schedule.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nessun calendario generato</p>
        ) : (
          <div className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{completedCount}/{schedule.length} lezioni ({progress}%)</span>
              </div>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Timeline */}
            <div className="relative">
              {schedule.map((item, idx) => {
                const status = getStatus(item);
                return (
                  <div key={item.id} className="flex gap-3 pb-4 last:pb-0">
                    {/* Vertical line + dot */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold",
                        status === 'completed' && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                        status === 'today' && "bg-primary text-primary-foreground ring-2 ring-primary/30",
                        status === 'past' && "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
                        status === 'future' && "bg-muted text-muted-foreground",
                      )}>
                        {status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : status === 'today' ? (
                          <ArrowRight className="w-4 h-4" />
                        ) : (
                          <span>{item.lesson_number}</span>
                        )}
                      </div>
                      {idx < schedule.length - 1 && (
                        <div className={cn(
                          "w-0.5 flex-1 min-h-4",
                          status === 'completed' ? "bg-green-300 dark:bg-green-700" : "bg-muted"
                        )} />
                      )}
                    </div>

                    {/* Content */}
                    <div className={cn(
                      "flex-1 pb-2 pt-1",
                      status === 'future' && "opacity-50"
                    )}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {item.lesson_title || `Lezione ${item.lesson_number}`}
                        </span>
                        {status === 'today' && <Badge className="text-[10px] bg-primary">OGGI</Badge>}
                        {status === 'completed' && (
                          <Badge variant="secondary" className="text-[10px]">
                            ✅ {item.present_count}/{item.total_students}
                          </Badge>
                        )}
                        {status === 'past' && !item.has_attendance && (
                          <Badge variant="outline" className="text-[10px] text-orange-600 border-orange-300">
                            Presenze mancanti
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{format(parseISO(item.lesson_date), "EEEE d MMMM yyyy", { locale: it })}</span>
                        {item.lesson_time && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {item.lesson_time.substring(0, 5)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
