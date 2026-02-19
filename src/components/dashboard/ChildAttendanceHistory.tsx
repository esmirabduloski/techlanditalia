import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CalendarCheck, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface AttendanceStatus {
  lessonNumber: number;
  lessonDate: string;
  lessonTitle: string | null;
  status: 'present' | 'absent' | 'excused' | 'justified' | 'pending';
}

interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  justified: number;
  percentage: number;
}

interface ChildAttendanceHistoryProps {
  childId: string;
  childName?: string;
  groupIds?: string[];
}

export function ChildAttendanceHistory({ childId, childName, groupIds: filterGroupIds }: ChildAttendanceHistoryProps) {
  const [attendanceHistory, setAttendanceHistory] = useState<Record<string, AttendanceStatus[]>>({});
  const [stats, setStats] = useState<AttendanceStats>({ total: 0, present: 0, absent: 0, justified: 0, percentage: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (childId) {
      fetchAttendanceHistory();
    }
  }, [childId, filterGroupIds?.join(',')]);

  const fetchAttendanceHistory = async () => {
    setError(null);
    setIsLoading(true);
    try {
      let groupIds: string[];

      if (filterGroupIds) {
        groupIds = filterGroupIds;
      } else {
        // Fallback: fetch all groups
        const { data: groupStudentData, error: groupError } = await supabase
          .from("group_students")
          .select(`
            group_id,
            group:group_id (
              id,
              title,
              course:course_id (
                title,
                emoji
              )
            )
          `)
          .eq("student_id", childId);

        if (groupError) {
          console.error("Error fetching group_students:", groupError);
          setError(`Errore di caricamento gruppi: ${groupError.message}`);
          setIsLoading(false);
          return;
        }

        if (!groupStudentData || groupStudentData.length === 0) {
          setAttendanceHistory({});
          setIsLoading(false);
          return;
        }

        groupIds = groupStudentData.map((gs: any) => gs.group_id);
      }

      if (groupIds.length === 0) {
        setAttendanceHistory({});
        setIsLoading(false);
        return;
      }

      // Get lesson schedule for these groups
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("group_lesson_schedule")
        .select(`
          id,
          lesson_number,
          lesson_date,
          lesson_title,
          group:group_id (
            id,
            title,
            course:course_id (
              title,
              emoji
            )
          )
        `)
        .in("group_id", groupIds)
        .order("lesson_number", { ascending: true });

      if (scheduleError) {
        console.error("Error fetching group_lesson_schedule:", scheduleError);
        setError(`Errore di caricamento calendario: ${scheduleError.message}`);
        setIsLoading(false);
        return;
      }

      // Get attendance records for this student from group_attendance
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("group_attendance")
        .select("group_id, lesson_number, status")
        .eq("student_id", childId)
        .in("group_id", groupIds);

      if (attendanceError) {
        console.error("Error fetching group_attendance:", attendanceError);
        setError(`Errore di caricamento presenze: ${attendanceError.message}`);
        setIsLoading(false);
        return;
      }

      // Build attendance map
      const attendanceMap = new Map<string, string>();
      attendanceData?.forEach(a => {
        const key = `${a.group_id}-${a.lesson_number}`;
        attendanceMap.set(key, a.status);
      });

      // Group by course
      const historyByCourse: Record<string, AttendanceStatus[]> = {};
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalJustified = 0;

      scheduleData?.forEach((lesson: any) => {
        const courseKey = `${lesson.group.course.emoji} ${lesson.group.course.title}`;
        if (!historyByCourse[courseKey]) {
          historyByCourse[courseKey] = [];
        }

        const key = `${lesson.group.id}-${lesson.lesson_number}`;
        const attendanceStatus = attendanceMap.get(key);
        
        let status: AttendanceStatus['status'] = 'pending';
        const lessonDate = new Date(lesson.lesson_date);
        const isPast = lessonDate < new Date();

        if (attendanceStatus === 'present') {
          status = 'present';
          totalPresent++;
        } else if (attendanceStatus === 'absent') {
          status = 'absent';
          totalAbsent++;
        } else if (attendanceStatus === 'justified' || attendanceStatus === 'excused') {
          status = 'justified';
          totalJustified++;
        } else if (isPast) {
          // Past lesson with no record - assume absent
          status = 'absent';
          totalAbsent++;
        }

        historyByCourse[courseKey].push({
          lessonNumber: lesson.lesson_number,
          lessonDate: lesson.lesson_date,
          lessonTitle: lesson.lesson_title,
          status,
        });
      });

      const total = totalPresent + totalAbsent + totalJustified;
      const percentage = total > 0 ? Math.round((totalPresent / total) * 100) : 0;

      setStats({ total, present: totalPresent, absent: totalAbsent, justified: totalJustified, percentage });
      setAttendanceHistory(historyByCourse);
    } catch (err: any) {
      console.error("Error fetching attendance history:", err);
      setError(`Errore imprevisto: ${err?.message || 'Sconosciuto'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Storico Presenze{childName ? ` di ${childName}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchAttendanceHistory}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Riprova
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (Object.keys(attendanceHistory).length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Storico Presenze{childName ? ` di ${childName}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-4">
            Nessuna presenza registrata
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Storico Presenze{childName ? ` di ${childName}` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Stats summary */}
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Totale</p>
          </div>
          <div className="text-center p-2 bg-green-500/10 rounded-lg">
            <p className="text-2xl font-bold text-green-600">{stats.present}</p>
            <p className="text-xs text-muted-foreground">Presenze</p>
          </div>
          <div className="text-center p-2 bg-red-500/10 rounded-lg">
            <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
            <p className="text-xs text-muted-foreground">Assenze</p>
          </div>
          <div className="text-center p-2 bg-yellow-500/10 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{stats.justified}</p>
            <p className="text-xs text-muted-foreground">Giustificate</p>
          </div>
        </div>

        {/* Percentage bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-muted-foreground">Percentuale presenza</span>
            <span className={cn(
              "font-medium",
              stats.percentage >= 80 ? "text-green-600" :
              stats.percentage >= 60 ? "text-yellow-600" : "text-red-600"
            )}>
              {stats.percentage}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                stats.percentage >= 80 ? "bg-green-500" :
                stats.percentage >= 60 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${stats.percentage}%` }}
            />
          </div>
        </div>

        <ScrollArea className="h-[200px]">
          <div className="space-y-6">
            {Object.entries(attendanceHistory).map(([courseTitle, lessons]) => (
              <div key={courseTitle} className="space-y-3">
                <h4 className="font-medium text-foreground">{courseTitle}</h4>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {lessons.map((lesson) => {
                    const lessonLabel = `L${lesson.lessonNumber}`;
                    
                    return (
                      <div
                        key={`${courseTitle}-${lesson.lessonNumber}`}
                        className={cn(
                          "p-2 rounded-lg border text-center transition-colors",
                          lesson.status === 'present' && "bg-green-500/10 border-green-500/30",
                          lesson.status === 'absent' && "bg-red-500/10 border-red-500/30",
                          lesson.status === 'justified' && "bg-yellow-500/10 border-yellow-500/30",
                          lesson.status === 'pending' && "bg-muted/30 border-muted"
                        )}
                        title={lesson.lessonTitle || `Lezione ${lesson.lessonNumber}`}
                      >
                        <p className={cn(
                          "text-xs font-medium",
                          lesson.status === 'present' && "text-green-600",
                          lesson.status === 'absent' && "text-red-600",
                          lesson.status === 'justified' && "text-yellow-600",
                          lesson.status === 'pending' && "text-muted-foreground"
                        )}>
                          {lessonLabel}
                        </p>
                        {lesson.status === 'present' && (
                          <CheckCircle2 className="w-4 h-4 mx-auto mt-1 text-green-600" />
                        )}
                        {lesson.status === 'absent' && (
                          <XCircle className="w-4 h-4 mx-auto mt-1 text-red-600" />
                        )}
                        {lesson.status === 'justified' && (
                          <Badge className="text-[10px] mt-1 bg-yellow-500/20 text-yellow-600 border-0">
                            G
                          </Badge>
                        )}
                        {lesson.status === 'pending' && (
                          <Clock className="w-4 h-4 mx-auto mt-1 text-muted-foreground/50" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500/30 border border-green-500/50" />
            <span>Presente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50" />
            <span>Assente</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-yellow-500/30 border border-yellow-500/50" />
            <span>Giustificato</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted/50 border border-muted" />
            <span>Programmata</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
