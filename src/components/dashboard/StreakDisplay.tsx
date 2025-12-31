import { Flame, BookOpen, CalendarCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StreakDisplayProps {
  homeworkStreak: number;
  attendanceStreak: number;
  bestHomeworkStreak: number;
  bestAttendanceStreak: number;
  compact?: boolean;
}

export function StreakDisplay({
  homeworkStreak,
  attendanceStreak,
  bestHomeworkStreak,
  bestAttendanceStreak,
  compact = false,
}: StreakDisplayProps) {
  if (compact) {
    return (
      <div className="flex gap-4">
        <StreakBadge
          icon={<BookOpen className="h-4 w-4" />}
          value={homeworkStreak}
          label="Compiti"
          best={bestHomeworkStreak}
          compact
        />
        <StreakBadge
          icon={<CalendarCheck className="h-4 w-4" />}
          value={attendanceStreak}
          label="Presenze"
          best={bestAttendanceStreak}
          compact
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              homeworkStreak > 0 ? "bg-orange-500/20" : "bg-muted"
            )}>
              <Flame className={cn(
                "h-6 w-6",
                homeworkStreak > 0 ? "text-orange-500 animate-pulse" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{homeworkStreak}</span>
                <span className="text-sm text-muted-foreground">giorni</span>
              </div>
              <p className="text-xs text-muted-foreground">Streak Compiti</p>
            </div>
          </div>
          {bestHomeworkStreak > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Record: {bestHomeworkStreak} giorni 🏆
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full",
              attendanceStreak > 0 ? "bg-green-500/20" : "bg-muted"
            )}>
              <CalendarCheck className={cn(
                "h-6 w-6",
                attendanceStreak > 0 ? "text-green-500" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{attendanceStreak}</span>
                <span className="text-sm text-muted-foreground">lezioni</span>
              </div>
              <p className="text-xs text-muted-foreground">Streak Presenze</p>
            </div>
          </div>
          {bestAttendanceStreak > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Record: {bestAttendanceStreak} lezioni 🏆
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface StreakBadgeProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  best: number;
  compact?: boolean;
}

function StreakBadge({ icon, value, label, best, compact }: StreakBadgeProps) {
  return (
    <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg">
      <div className={cn(
        "p-1 rounded-full",
        value > 0 ? "bg-orange-500/20 text-orange-500" : "bg-muted text-muted-foreground"
      )}>
        {value > 0 ? <Flame className="h-4 w-4 animate-pulse" /> : icon}
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="font-bold text-foreground">{value}</span>
          {!compact && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
        {compact && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
