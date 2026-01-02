import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface CelebrationData {
  type: 'badge' | 'level-up';
  title: string;
  subtitle?: string;
  emoji?: string;
}

interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
}

interface LevelInfo {
  level: number;
  name: string;
  badge_emoji: string;
}

export function useCelebration() {
  const { user } = useAuth();
  const [celebration, setCelebration] = useState<CelebrationData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const previousBadgeCount = useRef<number | null>(null);
  const previousLevel = useRef<number | null>(null);
  const celebrationQueue = useRef<CelebrationData[]>([]);
  const isProcessing = useRef(false);

  const showCelebration = useCallback((data: CelebrationData) => {
    celebrationQueue.current.push(data);
    processQueue();
  }, []);

  const processQueue = useCallback(() => {
    if (isProcessing.current || celebrationQueue.current.length === 0) return;
    
    isProcessing.current = true;
    const next = celebrationQueue.current.shift();
    if (next) {
      setCelebration(next);
      setIsVisible(true);
    }
  }, []);

  const hideCelebration = useCallback(() => {
    setIsVisible(false);
    setCelebration(null);
    isProcessing.current = false;
    // Process next in queue after a short delay
    setTimeout(() => processQueue(), 500);
  }, [processQueue]);

  // Check for new badges
  const checkForNewBadges = useCallback(async () => {
    if (!user) return;

    const { data: achievements } = await supabase
      .from('user_achievements')
      .select(`
        id,
        badge:badges (
          id,
          name,
          emoji,
          description
        )
      `)
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false });

    if (achievements) {
      const currentCount = achievements.length;
      
      if (previousBadgeCount.current !== null && currentCount > previousBadgeCount.current) {
        // New badge(s) earned!
        const newBadges = achievements.slice(0, currentCount - previousBadgeCount.current);
        
        for (const achievement of newBadges) {
          const badge = achievement.badge as Badge | null;
          if (badge) {
            showCelebration({
              type: 'badge',
              title: badge.name,
              subtitle: badge.description,
              emoji: badge.emoji,
            });
          }
        }
      }
      
      previousBadgeCount.current = currentCount;
    }
  }, [user, showCelebration]);

  // Check for level up
  const checkForLevelUp = useCallback(async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('total_points')
      .eq('id', user.id)
      .single();

    if (profile) {
      const { data: levels } = await supabase
        .from('gamification_levels')
        .select('*')
        .lte('min_points', profile.total_points)
        .order('level', { ascending: false })
        .limit(1);

      if (levels && levels.length > 0) {
        const currentLevel = levels[0] as LevelInfo;
        
        if (previousLevel.current !== null && currentLevel.level > previousLevel.current) {
          showCelebration({
            type: 'level-up',
            title: `Livello ${currentLevel.level}`,
            subtitle: `Sei diventato ${currentLevel.name}! ${currentLevel.badge_emoji}`,
          });
        }
        
        previousLevel.current = currentLevel.level;
      }
    }
  }, [user, showCelebration]);

  // Initialize previous values
  useEffect(() => {
    if (!user) return;

    const initializeValues = async () => {
      // Get initial badge count
      const { count: badgeCount } = await supabase
        .from('user_achievements')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      previousBadgeCount.current = badgeCount || 0;

      // Get initial level
      const { data: profile } = await supabase
        .from('profiles')
        .select('total_points')
        .eq('id', user.id)
        .single();

      if (profile) {
        const { data: levels } = await supabase
          .from('gamification_levels')
          .select('level')
          .lte('min_points', profile.total_points)
          .order('level', { ascending: false })
          .limit(1);

        if (levels && levels.length > 0) {
          previousLevel.current = levels[0].level;
        }
      }
    };

    initializeValues();
  }, [user]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to user_achievements changes
    const achievementsChannel = supabase
      .channel('achievements-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_achievements',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          checkForNewBadges();
        }
      )
      .subscribe();

    // Subscribe to profile changes (for level up)
    const profileChannel = supabase
      .channel('profile-points-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          checkForLevelUp();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(achievementsChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user, checkForNewBadges, checkForLevelUp]);

  return {
    celebration,
    isVisible,
    showCelebration,
    hideCelebration,
  };
}
