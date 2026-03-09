import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AvatarDisplay } from '@/components/gamification/AvatarSelector';
import { getLevelFromPoints } from '@/components/gamification/LevelBadge';
import { Trophy, Medal, Award, Crown, Eye, EyeOff, ArrowLeft, Loader2, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  avatar_id: number;
  total_points: number;
  role: string;
}

interface CourseOption {
  id: string;
  title: string;
  emoji: string;
}

interface GroupOption {
  id: string;
  title: string;
}

export default function Leaderboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { enrollments, effectiveUserId } = useStudentProgress();
  const navigate = useNavigate();

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [anonymize, setAnonymize] = useState(false);
  const [filterType, setFilterType] = useState<'global' | 'course' | 'group'>('global');
  const [filterId, setFilterId] = useState<string | null>(null);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);

  // Fetch filter options
  useEffect(() => {
    if (!effectiveUserId) return;

    const fetchOptions = async () => {
      // Get courses from enrollments
      const uniqueCourses = enrollments.map(e => ({
        id: e.course_id,
        title: e.course.title,
        emoji: e.course.emoji,
      }));
      setCourses(uniqueCourses);

      // Get groups
      const { data: groupData } = await supabase
        .from('group_students')
        .select('group_id, student_groups(id, title)')
        .eq('student_id', effectiveUserId);

      if (groupData) {
        const gs = groupData
          .filter(g => g.student_groups)
          .map(g => {
            const sg = Array.isArray(g.student_groups) ? g.student_groups[0] : g.student_groups;
            return { id: sg.id, title: sg.title };
          });
        setGroups(gs);
      }
    };

    fetchOptions();
  }, [effectiveUserId, enrollments]);

  // Fetch leaderboard
  useEffect(() => {
    fetchLeaderboard();
  }, [filterType, filterId]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_leaderboard', {
        _filter_type: filterType,
        _filter_id: filterId,
        _limit: 50,
      });

      if (!error && data) {
        setEntries(data as LeaderboardEntry[]);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (type: 'global' | 'course' | 'group') => {
    setFilterType(type);
    setFilterId(null);
  };

  const currentUserRank = useMemo(() => {
    return entries.find(e => e.user_id === effectiveUserId);
  }, [entries, effectiveUserId]);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-6 w-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-sm font-bold text-muted-foreground w-6 text-center">{rank}</span>;
  };

  const getDisplayName = (entry: LeaderboardEntry) => {
    if (!anonymize) return entry.full_name;
    if (entry.user_id === effectiveUserId) return entry.full_name + ' (Tu)';
    return `Studente #${entry.rank}`;
  };

  const getRankBg = (rank: number, isCurrentUser: boolean) => {
    if (isCurrentUser) return 'bg-primary/10 border-primary/30';
    if (rank === 1) return 'bg-yellow-500/10 border-yellow-500/30';
    if (rank === 2) return 'bg-gray-300/10 border-gray-300/30';
    if (rank === 3) return 'bg-amber-600/10 border-amber-600/30';
    return 'bg-card border-border';
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/area-riservata"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-7 w-7 text-yellow-500" />
              Classifica
            </h1>
            <p className="text-sm text-muted-foreground">Scopri chi è in testa!</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4 space-y-4">
            {/* Filter type buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterType === 'global' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('global')}
              >
                <Users className="h-4 w-4 mr-1" /> Globale
              </Button>
              <Button
                variant={filterType === 'course' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('course')}
              >
                📚 Per Corso
              </Button>
              <Button
                variant={filterType === 'group' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleFilterChange('group')}
              >
                👥 Per Gruppo
              </Button>
            </div>

            {/* Course/Group selector */}
            {filterType === 'course' && (
              <Select value={filterId || ''} onValueChange={setFilterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un corso" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.emoji} {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filterType === 'group' && (
              <Select value={filterId || ''} onValueChange={setFilterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un gruppo" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Anonymize toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                {anonymize ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span>Anonimizza nomi</span>
              </div>
              <Switch checked={anonymize} onCheckedChange={setAnonymize} />
            </div>
          </CardContent>
        </Card>

        {/* Current user highlight */}
        {currentUserRank && (
          <Card className="mb-6 border-primary/40 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="text-2xl font-bold text-primary">#{currentUserRank.rank}</div>
              <AvatarDisplay avatarId={currentUserRank.avatar_id} level={getLevelFromPoints(currentUserRank.total_points).level} size="md" />
              <div className="flex-1">
                <p className="font-semibold">{currentUserRank.full_name}</p>
                <p className="text-sm text-muted-foreground">
                  {getLevelFromPoints(currentUserRank.total_points).badge_emoji}{' '}
                  {getLevelFromPoints(currentUserRank.total_points).name} • {currentUserRank.total_points} punti
                </p>
              </div>
              <Award className="h-6 w-6 text-primary" />
            </CardContent>
          </Card>
        )}

        {/* Leaderboard list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              {filterType !== 'global' && !filterId
                ? 'Seleziona un filtro per visualizzare la classifica'
                : 'Nessuno studente trovato'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => {
              const isCurrentUser = entry.user_id === effectiveUserId;
              const level = getLevelFromPoints(entry.total_points);

              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <div
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${getRankBg(
                      entry.rank,
                      isCurrentUser
                    )} ${isCurrentUser ? 'ring-2 ring-primary/30' : ''}`}
                  >
                    {/* Rank */}
                    <div className="w-8 flex items-center justify-center">
                      {getRankIcon(entry.rank)}
                    </div>

                    {/* Avatar */}
                    {anonymize && entry.user_id !== effectiveUserId ? (
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-lg">
                        🎭
                      </div>
                    ) : (
                      <AvatarDisplay avatarId={entry.avatar_id} size="sm" />
                    )}

                    {/* Name & Level */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {getDisplayName(entry)}
                        {isCurrentUser && !anonymize && (
                          <span className="ml-1 text-xs text-primary">(Tu)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {level.badge_emoji} {level.name}
                      </p>
                    </div>

                    {/* Points */}
                    <div className="text-right">
                      <p className="font-bold text-sm">{entry.total_points}</p>
                      <p className="text-xs text-muted-foreground">punti</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
