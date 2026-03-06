import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, Lock, ChevronDown } from "lucide-react";
import { SocialShareButton } from "@/components/gamification/SocialShareButton";
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

interface ParentBadgesSectionProps {
  childId: string;
  childName: string;
}

const INITIAL_BADGES_COUNT = 10;

export function ParentBadgesSection({ childId, childName }: ParentBadgesSectionProps) {
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (childId) {
      fetchBadges();
    }
  }, [childId]);

  const fetchBadges = async () => {
    try {
      const { data: allBadges } = await supabase
        .from("badges")
        .select("*")
        .order("category", { ascending: true });

      const { data: achievements } = await supabase
        .from("user_achievements")
        .select("badge_id, earned_at")
        .eq("user_id", childId);

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

  const displayBadges = showAll ? badges : badges.slice(0, INITIAL_BADGES_COUNT);
  const earnedCount = badges.filter((b) => b.isEarned).length;
  const hasMore = badges.length > INITIAL_BADGES_COUNT;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          🏆 Badge di {childName}
        </h3>
        <Badge variant="secondary" className="text-sm">
          {earnedCount}/{badges.length} sbloccati
        </Badge>
      </div>

      {displayBadges.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Nessun badge ottenuto ancora
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            <TooltipProvider>
              {displayBadges.map((badge) => (
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
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>

          {hasMore && !showAll && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => setShowAll(true)}
                className="gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                Mostra altri ({badges.length - INITIAL_BADGES_COUNT} rimanenti)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
