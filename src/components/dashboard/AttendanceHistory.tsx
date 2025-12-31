import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarCheck, CalendarX, CalendarMinus, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
  id: string;
  status: 'present' | 'absent_unexcused' | 'absent_excused';
  notes: string | null;
  marked_at: string;
  scheduled_lesson: {
    id: string;
    title: string;
    lesson_date: string;
    course: {
      title: string;
      emoji: string;
    };
  };
}

interface AttendanceStats {
  total: number;
  present: number;
  absent_unexcused: number;
  absent_excused: number;
  percentage: number;
}

interface AttendanceHistoryProps {
  attendance: AttendanceRecord[];
  stats: AttendanceStats;
  compact?: boolean;
}

export function AttendanceHistory({ attendance, stats, compact = false }: AttendanceHistoryProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'present':
        return {
          icon: CalendarCheck,
          label: 'Presente',
          className: 'bg-green-500/10 text-green-600 border-green-500/20',
        };
      case 'absent_unexcused':
        return {
          icon: CalendarX,
          label: 'Assente',
          className: 'bg-red-500/10 text-red-600 border-red-500/20',
        };
      case 'absent_excused':
        return {
          icon: CalendarMinus,
          label: 'Giustificato',
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
        };
      default:
        return {
          icon: CalendarCheck,
          label: status,
          className: 'bg-muted text-muted-foreground',
        };
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Presenza</span>
          </div>
          <span className={cn(
            "text-lg font-bold",
            stats.percentage >= 80 ? "text-green-600" :
            stats.percentage >= 60 ? "text-yellow-600" : "text-red-600"
          )}>
            {stats.percentage}%
          </span>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {stats.present}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {stats.absent_unexcused}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            {stats.absent_excused}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Storico Presenze
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
            <p className="text-2xl font-bold text-red-600">{stats.absent_unexcused}</p>
            <p className="text-xs text-muted-foreground">Assenze</p>
          </div>
          <div className="text-center p-2 bg-yellow-500/10 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">{stats.absent_excused}</p>
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

        {/* Attendance list */}
        {attendance.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nessuna presenza registrata
          </p>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-2">
              {attendance.map((record) => {
                const config = getStatusConfig(record.status);
                const Icon = config.icon;
                return (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {record.scheduled_lesson.course.emoji}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {record.scheduled_lesson.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(record.scheduled_lesson.lesson_date), 'd MMMM yyyy', { locale: it })}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={config.className}>
                      <Icon className="h-3 w-3 mr-1" />
                      {config.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
