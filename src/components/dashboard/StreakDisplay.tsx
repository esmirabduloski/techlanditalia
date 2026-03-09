import { Flame, BookOpen, CalendarCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { NextMilestoneProgress } from './StreakBonusesDisplay';

interface StreakDisplayProps {
  homeworkStreak: number;
  attendanceStreak: number;
  bestHomeworkStreak: number;
  bestAttendanceStreak: number;
  compact?: boolean;
  showMilestoneProgress?: boolean;
  lastHomeworkDate?: string | null;
  lastAttendanceDate?: string | null;
}

// Returns flame size & style based on streak value
function getFlameConfig(streak: number) {
  if (streak >= 32) return { size: 'h-10 w-10', color: 'text-yellow-400', animation: 'animate-pulse', label: '👑 Leggenda!', glow: 'shadow-[0_0_20px_rgba(250,204,21,0.5)]' };
  if (streak >= 28) return { size: 'h-9 w-9', color: 'text-purple-500', animation: 'animate-pulse', label: '💎 Diamante', glow: 'shadow-[0_0_16px_rgba(168,85,247,0.4)]' };
  if (streak >= 21) return { size: 'h-8 w-8', color: 'text-yellow-500', animation: 'animate-pulse', label: '⭐ Stella', glow: 'shadow-[0_0_14px_rgba(234,179,8,0.4)]' };
  if (streak >= 14) return { size: 'h-7 w-7', color: 'text-blue-500', animation: 'animate-pulse', label: '🚀 Razzo', glow: 'shadow-[0_0_12px_rgba(59,130,246,0.4)]' };
  if (streak >= 7) return { size: 'h-7 w-7', color: 'text-orange-500', animation: 'animate-pulse', label: '🔥 In fiamme!', glow: 'shadow-[0_0_10px_rgba(249,115,22,0.3)]' };
  if (streak >= 3) return { size: 'h-6 w-6', color: 'text-orange-500', animation: 'animate-pulse', label: '', glow: '' };
  if (streak > 0) return { size: 'h-6 w-6', color: 'text-orange-400', animation: '', label: '', glow: '' };
  return { size: 'h-6 w-6', color: 'text-muted-foreground', animation: '', label: '', glow: '' };
}

function getCardGradient(streak: number, type: 'homework' | 'attendance') {
  if (type === 'homework') {
    if (streak >= 28) return 'from-yellow-500/15 to-purple-500/15 border-yellow-500/30';
    if (streak >= 21) return 'from-yellow-500/15 to-amber-500/15 border-yellow-500/25';
    if (streak >= 14) return 'from-blue-500/15 to-indigo-500/15 border-blue-500/25';
    if (streak >= 7) return 'from-orange-500/15 to-red-500/15 border-orange-500/25';
    return 'from-orange-500/10 to-red-500/10 border-orange-500/20';
  }
  if (streak >= 28) return 'from-yellow-500/15 to-purple-500/15 border-yellow-500/30';
  if (streak >= 21) return 'from-yellow-500/15 to-amber-500/15 border-yellow-500/25';
  if (streak >= 14) return 'from-blue-500/15 to-teal-500/15 border-blue-500/25';
  if (streak >= 7) return 'from-green-500/15 to-emerald-500/15 border-green-500/25';
  return 'from-green-500/10 to-emerald-500/10 border-green-500/20';
}

// Check if streak is at risk (no activity for a while)
function isStreakAtRisk(lastDate: string | null, streakValue: number): boolean {
  if (!lastDate || streakValue === 0) return false;
  const last = new Date(lastDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 5; // warn after 5 days of inactivity
}

export function StreakDisplay({
  homeworkStreak,
  attendanceStreak,
  bestHomeworkStreak,
  bestAttendanceStreak,
  compact = false,
  showMilestoneProgress = true,
  lastHomeworkDate,
  lastAttendanceDate,
}: StreakDisplayProps) {
  const hwAtRisk = isStreakAtRisk(lastHomeworkDate ?? null, homeworkStreak);
  const attAtRisk = isStreakAtRisk(lastAttendanceDate ?? null, attendanceStreak);

  if (compact) {
    return (
      <div className="flex gap-4">
        <StreakBadge
          icon={<BookOpen className="h-4 w-4" />}
          value={homeworkStreak}
          label="Compiti"
          best={bestHomeworkStreak}
          atRisk={hwAtRisk}
          compact
        />
        <StreakBadge
          icon={<CalendarCheck className="h-4 w-4" />}
          value={attendanceStreak}
          label="Presenze"
          best={bestAttendanceStreak}
          atRisk={attAtRisk}
          compact
        />
      </div>
    );
  }

  const hwFlame = getFlameConfig(homeworkStreak);
  const attFlame = getFlameConfig(attendanceStreak);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Homework Streak Card */}
      <Card className={cn("bg-gradient-to-br border", getCardGradient(homeworkStreak, 'homework'))}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full transition-all",
              homeworkStreak > 0 ? "bg-orange-500/20" : "bg-muted",
              hwFlame.glow
            )}>
              <Flame className={cn(hwFlame.size, hwFlame.color, hwFlame.animation)} />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{homeworkStreak}</span>
                <span className="text-sm text-muted-foreground">giorni</span>
              </div>
              <p className="text-xs text-muted-foreground">Streak Compiti</p>
            </div>
            {hwFlame.label && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-background/50 border border-border/50">
                {hwFlame.label}
              </span>
            )}
          </div>

          {/* At-risk warning */}
          {hwAtRisk && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg animate-pulse">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">Attenzione! Rischi di perdere la streak! Consegna un compito!</span>
            </div>
          )}

          {bestHomeworkStreak > 0 && (
            <p className="text-xs text-muted-foreground">
              Record: {bestHomeworkStreak} giorni 🏆
            </p>
          )}
          {showMilestoneProgress && homeworkStreak > 0 && (
            <NextMilestoneProgress currentStreak={homeworkStreak} streakType="homework" />
          )}
        </CardContent>
      </Card>

      {/* Attendance Streak Card */}
      <Card className={cn("bg-gradient-to-br border", getCardGradient(attendanceStreak, 'attendance'))}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-full transition-all",
              attendanceStreak > 0 ? "bg-green-500/20" : "bg-muted",
              attFlame.glow
            )}>
              {attendanceStreak >= 7 ? (
                <Flame className={cn(attFlame.size, attFlame.color, attFlame.animation)} />
              ) : (
                <CalendarCheck className={cn(
                  "h-6 w-6",
                  attendanceStreak > 0 ? "text-green-500" : "text-muted-foreground"
                )} />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{attendanceStreak}</span>
                <span className="text-sm text-muted-foreground">lezioni</span>
              </div>
              <p className="text-xs text-muted-foreground">Streak Presenze</p>
            </div>
            {attFlame.label && (
              <span className="text-xs font-medium px-2 py-1 rounded-full bg-background/50 border border-border/50">
                {attFlame.label}
              </span>
            )}
          </div>

          {/* At-risk warning */}
          {attAtRisk && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-2 rounded-lg animate-pulse">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">Non mancare alla prossima lezione per mantenere la streak!</span>
            </div>
          )}

          {bestAttendanceStreak > 0 && (
            <p className="text-xs text-muted-foreground">
              Record: {bestAttendanceStreak} lezioni 🏆
            </p>
          )}
          {showMilestoneProgress && attendanceStreak > 0 && (
            <NextMilestoneProgress currentStreak={attendanceStreak} streakType="attendance" />
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
  atRisk?: boolean;
}

function StreakBadge({ icon, value, label, best, compact, atRisk }: StreakBadgeProps) {
  const flame = getFlameConfig(value);

  return (
    <div className={cn(
      "flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg relative",
      atRisk && "ring-2 ring-amber-500/50"
    )}>
      <div className={cn(
        "p-1 rounded-full",
        value > 0 ? "bg-orange-500/20 text-orange-500" : "bg-muted text-muted-foreground"
      )}>
        {value > 0 ? <Flame className={cn("h-4 w-4", flame.animation)} /> : icon}
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="font-bold text-foreground">{value}</span>
          {!compact && <span className="text-xs text-muted-foreground">{label}</span>}
        </div>
        {compact && <span className="text-xs text-muted-foreground">{label}</span>}
      </div>
      {atRisk && (
        <AlertTriangle className="h-3 w-3 text-amber-500 absolute -top-1 -right-1" />
      )}
    </div>
  );
}
