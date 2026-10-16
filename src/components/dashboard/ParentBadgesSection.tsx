import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown } from "lucide-react";
import { SocialShareButton } from "@/components/gamification/SocialShareButton";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
      <div className="py-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const earned = badges.filter((b) => b.isEarned);
  const locked = badges.filter((b) => !b.isEarned);
  const displayBadges = showAll ? badges : earned;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {earned.length} badge sbloccati su {badges.length}. Tocca un badge per i dettagli.
      </p>

      {displayBadges.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">{childName} non ha ancora ottenuto badge</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {displayBadges.map((badge) => (
            <Popover key={badge.id}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "rounded-xl border p-2 text-center min-h-[88px] active:scale-[0.97] transition-transform",
                    badge.isEarned
                      ? "border-primary/50 bg-gradient-to-br from-card to-primary/10"
                      : "border-muted bg-muted/20 opacity-70",
                  )}
                >
                  <span className="text-3xl block" aria-hidden="true">{badge.isEarned ? badge.emoji : "🔒"}</span>
                  <span className={cn(
                    "block text-xs font-medium mt-1 line-clamp-2",
                    badge.isEarned ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {badge.name}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-64 text-center">
                <p className="font-semibold">{badge.emoji} {badge.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{badge.description}</p>
                {badge.isEarned && badge.earned_at && (
                  <p className="text-xs text-primary mt-2">
                    Ottenuto il {format(new Date(badge.earned_at), "d MMMM yyyy", { locale: it })}
                    {badge.points_reward > 0 && ` · +${badge.points_reward} punti`}
                  </p>
                )}
                {!badge.isEarned && <p className="text-xs text-muted-foreground mt-2">Non ancora sbloccato</p>}
                {badge.isEarned && (
                  <div className="mt-2">
                    <SocialShareButton
                      text={`${childName} ha ottenuto il badge "${badge.name}" su TechLand!`}
                      emoji={badge.emoji}
                      size="sm"
                      variant="ghost"
                    />
                  </div>
                )}
              </PopoverContent>
            </Popover>
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <Button variant="outline" className="w-full gap-2" onClick={() => setShowAll((v) => !v)}>
          <ChevronDown className={cn("w-4 h-4 transition-transform", showAll && "rotate-180")} />
          {showAll ? "Nascondi quelli da sbloccare" : `Mostra quelli da sbloccare (${locked.length})`}
        </Button>
      )}
    </div>
  );
}
