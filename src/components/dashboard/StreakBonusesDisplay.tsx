import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gift, Flame, CalendarCheck, Trophy, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface StreakBonus {
  id: string;
  streak_type: 'homework' | 'attendance';
  milestone: number;
  points_awarded: number;
  awarded_at: string;
}

interface StreakBonusesDisplayProps {
  bonuses: StreakBonus[];
  compact?: boolean;
  currentHomeworkStreak?: number;
  currentAttendanceStreak?: number;
}

const MILESTONE_CONFIG: Record<number, { emoji: string; label: string; color: string; points: number }> = {
  7: { emoji: '🔥', label: 'Una settimana', color: 'from-orange-500/20 to-red-500/20 border-orange-500/30', points: 100 },
  14: { emoji: '🚀', label: 'Due settimane', color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30', points: 200 },
  21: { emoji: '⭐', label: 'Tre settimane', color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30', points: 300 },
  28: { emoji: '💎', label: 'Quattro settimane', color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30', points: 400 },
  32: { emoji: '👑', label: 'Leggenda!', color: 'from-yellow-400/20 to-yellow-600/20 border-yellow-400/30', points: 500 },
};

const MILESTONES = [7, 14, 21, 28, 32];

export function StreakBonusesDisplay({ bonuses, compact = false, currentHomeworkStreak = 0, currentAttendanceStreak = 0 }: StreakBonusesDisplayProps) {
  // Sort by awarded_at descending
  const sortedBonuses = [...bonuses].sort(
    (a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime()
  );

  if (compact) {
    if (bonuses.length === 0) return null;
    const recentBonuses = sortedBonuses.slice(0, 3);
    return (
      <div className="flex flex-wrap gap-2">
        {recentBonuses.map((bonus) => {
          const config = MILESTONE_CONFIG[bonus.milestone];
          return (
            <Badge
              key={bonus.id}
              variant="outline"
              className={cn(
                "bg-gradient-to-r px-3 py-1",
                config?.color || 'from-muted to-muted'
              )}
            >
              <span className="mr-1">{config?.emoji || '🎁'}</span>
              +{bonus.points_awarded} pts
            </Badge>
          );
        })}
      </div>
    );
  }

  // Build milestone roadmap for both streak types
  const earnedSet = new Set(bonuses.map(b => `${b.streak_type}-${b.milestone}`));

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Traguardi Streak
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Homework milestones */}
        <div>
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <Flame className="h-4 w-4 text-orange-500" />
            Compiti
          </h4>
          <div className="space-y-2">
            {MILESTONES.map((milestone) => {
              const config = MILESTONE_CONFIG[milestone];
              const isEarned = earnedSet.has(`homework-${milestone}`);
              const bonus = bonuses.find(b => b.streak_type === 'homework' && b.milestone === milestone);
              const progress = Math.min((currentHomeworkStreak / milestone) * 100, 100);

              return (
                <MilestoneRow
                  key={`hw-${milestone}`}
                  config={config}
                  milestone={milestone}
                  isEarned={isEarned}
                  earnedAt={bonus?.awarded_at}
                  progress={progress}
                  currentStreak={currentHomeworkStreak}
                />
              );
            })}
          </div>
        </div>

        {/* Attendance milestones */}
        <div>
          <h4 className="text-sm font-medium text-foreground flex items-center gap-2 mb-3">
            <CalendarCheck className="h-4 w-4 text-green-500" />
            Presenze
          </h4>
          <div className="space-y-2">
            {MILESTONES.map((milestone) => {
              const config = MILESTONE_CONFIG[milestone];
              const isEarned = earnedSet.has(`attendance-${milestone}`);
              const bonus = bonuses.find(b => b.streak_type === 'attendance' && b.milestone === milestone);
              const progress = Math.min((currentAttendanceStreak / milestone) * 100, 100);

              return (
                <MilestoneRow
                  key={`att-${milestone}`}
                  config={config}
                  milestone={milestone}
                  isEarned={isEarned}
                  earnedAt={bonus?.awarded_at}
                  progress={progress}
                  currentStreak={currentAttendanceStreak}
                />
              );
            })}
          </div>
        </div>

        {/* Recent bonuses earned */}
        {sortedBonuses.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Bonus Sbloccati di Recente
            </h4>
            <div className="grid gap-2">
              {sortedBonuses.slice(0, 4).map((bonus) => {
                const config = MILESTONE_CONFIG[bonus.milestone];
                const isHomework = bonus.streak_type === 'homework';
                return (
                  <div
                    key={bonus.id}
                    className={cn(
                      "flex items-center justify-between p-2 rounded-lg bg-gradient-to-r border text-sm",
                      config?.color || 'from-muted to-muted border-border'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config?.emoji || '🎁'}</span>
                      <span className="font-medium text-foreground">{config?.label}</span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {isHomework ? 'Compiti' : 'Presenze'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-primary font-bold text-sm">
                      <Trophy className="h-3 w-3" />
                      +{bonus.points_awarded}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MilestoneRowProps {
  config: { emoji: string; label: string; color: string; points: number };
  milestone: number;
  isEarned: boolean;
  earnedAt?: string;
  progress: number;
  currentStreak: number;
}

function MilestoneRow({ config, milestone, isEarned, earnedAt, progress, currentStreak }: MilestoneRowProps) {
  const remaining = milestone - currentStreak;

  return (
    <div className={cn(
      "flex items-center gap-3 p-2 rounded-lg border transition-all",
      isEarned
        ? cn("bg-gradient-to-r", config.color)
        : "bg-muted/30 border-border/50 opacity-75"
    )}>
      <span className={cn("text-xl", !isEarned && "grayscale opacity-50")}>
        {config.emoji}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className={cn("text-sm font-medium", isEarned ? "text-foreground" : "text-muted-foreground")}>
            {config.label} ({milestone}×)
          </span>
          <span className={cn("text-xs font-bold", isEarned ? "text-primary" : "text-muted-foreground")}>
            +{config.points} pts
          </span>
        </div>
        {isEarned ? (
          <p className="text-xs text-muted-foreground">
            ✅ Sbloccato {earnedAt ? format(new Date(earnedAt), "d MMM yyyy", { locale: it }) : ''}
          </p>
        ) : (
          <div className="mt-1">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              {remaining > 0 ? `Ancora ${remaining}` : 'Quasi!'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Progress indicators showing next milestone
interface NextMilestoneProps {
  currentStreak: number;
  streakType: 'homework' | 'attendance';
}

export function NextMilestoneProgress({ currentStreak, streakType }: NextMilestoneProps) {
  const nextMilestone = MILESTONES.find(m => m > currentStreak);
  
  if (!nextMilestone) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-500/10 px-3 py-2 rounded-lg">
        <span>👑</span>
        <span className="font-medium">Sei una Leggenda! Tutti i bonus sbloccati!</span>
      </div>
    );
  }

  const config = MILESTONE_CONFIG[nextMilestone];
  const progress = Math.round((currentStreak / nextMilestone) * 100);
  const remaining = nextMilestone - currentStreak;

  return (
    <div className="bg-muted/50 p-3 rounded-lg space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Prossimo bonus: {config?.emoji} {config?.label}
        </span>
        <span className="font-medium text-primary">+{config.points} pts</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        {remaining} {streakType === 'homework' ? 'giorni' : 'lezioni'} rimanenti
      </p>
    </div>
  );
}
