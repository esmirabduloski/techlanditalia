import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Lock } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BadgeData {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  points_reward: number;
  earned_at?: string;
  isEarned: boolean;
}

interface BadgesDisplayProps {
  userId: string;
  showAll?: boolean;
  maxItems?: number;
  title?: string;
}

export function BadgesDisplay({ userId, showAll = true, maxItems, title = "🏆 Badge e Achievement" }: BadgesDisplayProps) {
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchBadges();
    }
  }, [userId]);

  const fetchBadges = async () => {
    try {
      // Fetch all badges
      const { data: allBadges } = await supabase
        .from("badges")
        .select("*")
        .order("category", { ascending: true });

      // Fetch user achievements
      const { data: achievements } = await supabase
        .from("user_achievements")
        .select("badge_id, earned_at")
        .eq("user_id", userId);

      const achievementMap = new Map(
        achievements?.map((a) => [a.badge_id, a.earned_at]) || []
      );

      const badgesWithStatus: BadgeData[] = (allBadges || []).map((badge) => ({
        id: badge.id,
        name: badge.name,
        description: badge.description,
        emoji: badge.emoji,
        category: badge.category,
        points_reward: badge.points_reward,
        earned_at: achievementMap.get(badge.id),
        isEarned: achievementMap.has(badge.id),
      }));

      // Sort: earned first, then by category
      badgesWithStatus.sort((a, b) => {
        if (a.isEarned && !b.isEarned) return -1;
        if (!a.isEarned && b.isEarned) return 1;
        return a.category.localeCompare(b.category);
      });

      setBadges(badgesWithStatus);
    } catch (error) {
      console.error("Error fetching badges:", error);
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

  const displayBadges = showAll ? badges : badges.filter((b) => b.isEarned);
  const finalBadges = maxItems ? displayBadges.slice(0, maxItems) : displayBadges;
  const earnedCount = badges.filter((b) => b.isEarned).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          {title}
        </h2>
        <Badge variant="secondary" className="text-sm">
          {earnedCount}/{badges.length} sbloccati
        </Badge>
      </div>

      {finalBadges.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Nessun badge ottenuto ancora
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Completa lezioni e compiti per sbloccare badge!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <TooltipProvider>
            {finalBadges.map((badge) => (
              <Tooltip key={badge.id}>
                <TooltipTrigger asChild>
                  <Card
                    className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                      badge.isEarned
                        ? "border-primary/50 bg-gradient-to-br from-card to-primary/10"
                        : "border-muted bg-muted/20 opacity-60"
                    }`}
                  >
                    <CardContent className="p-3 text-center">
                      <div className="relative">
                        <span className="text-3xl md:text-4xl">
                          {badge.isEarned ? badge.emoji : "🔒"}
                        </span>
                        {!badge.isEarned && (
                          <Lock className="w-3 h-3 absolute -top-1 -right-1 text-muted-foreground" />
                        )}
                      </div>
                      <p className={`text-xs font-medium mt-2 truncate ${
                        badge.isEarned ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {badge.name}
                      </p>
                      {badge.isEarned && badge.points_reward > 0 && (
                        <Badge variant="outline" className="text-[10px] mt-1 px-1">
                          +{badge.points_reward}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <div className="text-center">
                    <p className="font-semibold">{badge.emoji} {badge.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {badge.description}
                    </p>
                    {badge.isEarned && badge.earned_at && (
                      <p className="text-xs text-primary mt-2">
                        Ottenuto: {format(new Date(badge.earned_at), "d MMMM yyyy", { locale: it })}
                      </p>
                    )}
                    {badge.points_reward > 0 && (
                      <p className="text-xs font-medium mt-1">
                        +{badge.points_reward} punti bonus
                      </p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
