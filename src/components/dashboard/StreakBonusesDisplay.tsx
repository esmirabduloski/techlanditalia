import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gift, Flame, CalendarCheck, Trophy } from 'lucide-react';
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
}

const MILESTONE_CONFIG: Record<number, { emoji: string; label: string; color: string }> = {
  7: { emoji: '🔥', label: 'Una settimana', color: 'from-orange-500/20 to-red-500/20 border-orange-500/30' },
  14: { emoji: '🚀', label: 'Due settimane', color: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30' },
  21: { emoji: '⭐', label: 'Tre settimane', color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30' },
  28: { emoji: '💎', label: 'Quattro settimane', color: 'from-purple-500/20 to-pink-500/20 border-purple-500/30' },
  32: { emoji: '👑', label: 'Leggenda!', color: 'from-yellow-400/20 to-yellow-600/20 border-yellow-400/30' },
};

export function StreakBonusesDisplay({ bonuses, compact = false }: StreakBonusesDisplayProps) {
  if (bonuses.length === 0) {
    return null;
  }

  // Sort by awarded_at descending to show most recent first
  const sortedBonuses = [...bonuses].sort(
    (a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime()
  );

  if (compact) {
    // Show only recent bonuses in compact mode
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

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          Bonus Streak Sbloccati
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {sortedBonuses.map((bonus) => {
            const config = MILESTONE_CONFIG[bonus.milestone];
            const isHomework = bonus.streak_type === 'homework';
            
            return (
              <div
                key={bonus.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg bg-gradient-to-r border",
                  config?.color || 'from-muted to-muted border-border'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{config?.emoji || '🎁'}</span>
                  <div>
                    <p className="font-medium text-foreground flex items-center gap-2">
                      {config?.label || `${bonus.milestone} giorni`}
                      <Badge variant="outline" className="text-xs">
                        {isHomework ? (
                          <>
                            <Flame className="h-3 w-3 mr-1 text-orange-500" />
                            Compiti
                          </>
                        ) : (
                          <>
                            <CalendarCheck className="h-3 w-3 mr-1 text-green-500" />
                            Presenze
                          </>
                        )}
                      </Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(bonus.awarded_at), "d MMMM yyyy", { locale: it })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-primary/10 px-3 py-1 rounded-full">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="font-bold text-primary">+{bonus.points_awarded}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Progress indicators showing next milestone
interface NextMilestoneProps {
  currentStreak: number;
  streakType: 'homework' | 'attendance';
}

export function NextMilestoneProgress({ currentStreak, streakType }: NextMilestoneProps) {
  const milestones = [7, 14, 21, 28, 32];
  const nextMilestone = milestones.find(m => m > currentStreak);
  
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
  const bonusPoints = [100, 200, 300, 400, 500][milestones.indexOf(nextMilestone)];

  return (
    <div className="bg-muted/50 p-3 rounded-lg space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Prossimo bonus: {config?.emoji} {config?.label}
        </span>
        <span className="font-medium text-primary">+{bonusPoints} pts</span>
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
