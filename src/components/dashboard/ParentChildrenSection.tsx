import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudentStreaks } from "@/hooks/useStudentStreaks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, Users, MessageCircle, Award, Calendar } from "lucide-react";
import { BadgesDisplay } from "@/components/gamification/BadgesDisplay";
import { LevelBadge, PointsDisplay, getLevelFromPoints } from "@/components/gamification/LevelBadge";
import { AvatarDisplay } from "@/components/gamification/AvatarSelector";
import { StreakDisplay } from "@/components/dashboard/StreakDisplay";
import { AttendanceHistory } from "@/components/dashboard/AttendanceHistory";
import { StreakBonusesDisplay } from "@/components/dashboard/StreakBonusesDisplay";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Child {
  id: string;
  full_name: string;
  email: string | null;
  avatar_id: number;
  total_points: number;
}

interface Comment {
  id: string;
  content: string;
  visibility: string[];
  created_at: string;
  author: {
    full_name: string;
    role: string;
  };
}

export function ParentChildrenSection() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isParent, setIsParent] = useState(false);
  const [activeChild, setActiveChild] = useState<string>("");

  useEffect(() => {
    if (user) {
      fetchChildrenData();
    }
  }, [user]);

  const fetchChildrenData = async () => {
    if (!user) return;

    try {
      // Check if user is a parent (has children linked to them)
      const { data: childrenData } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_id, total_points")
        .eq("parent_id", user.id);

      if (!childrenData || childrenData.length === 0) {
        setIsParent(false);
        setIsLoading(false);
        return;
      }

      setIsParent(true);
      setChildren(childrenData);
      setActiveChild(childrenData[0].id);

      // Fetch comments for all children
      const commentsMap: Record<string, Comment[]> = {};
      
      for (const child of childrenData) {
        const { data: childComments } = await supabase
          .from("student_comments")
          .select(`
            id,
            content,
            visibility,
            created_at,
            author:author_id (full_name, role)
          `)
          .eq("student_id", child.id)
          .order("created_at", { ascending: false });

        commentsMap[child.id] = (childComments || []).map((c: any) => ({
          id: c.id,
          content: c.content,
          visibility: c.visibility,
          created_at: c.created_at,
          author: c.author as { full_name: string; role: string },
        }));
      }

      setComments(commentsMap);
    } catch (error) {
      console.error("Error fetching children data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isParent && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const activeChildData = children.find(c => c.id === activeChild);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        I Tuoi Figli
      </h2>

      {children.length > 1 ? (
        <Tabs value={activeChild} onValueChange={setActiveChild}>
          <TabsList className="mb-4">
            {children.map(child => (
              <TabsTrigger key={child.id} value={child.id} className="gap-2">
                <AvatarDisplay avatarId={child.avatar_id} level={getLevelFromPoints(child.total_points).level} size="sm" />
                {child.full_name}
              </TabsTrigger>
            ))}
          </TabsList>

          {children.map(child => (
            <TabsContent key={child.id} value={child.id} className="space-y-6">
              <ChildDashboard 
                child={child} 
                comments={comments[child.id] || []} 
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        activeChildData && (
          <ChildDashboard 
            child={activeChildData} 
            comments={comments[activeChildData.id] || []} 
          />
        )
      )}
    </div>
  );
}

function ChildDashboard({ child, comments }: { child: Child; comments: Comment[] }) {
  const level = getLevelFromPoints(child.total_points);
  const { streaks, attendance, stats, bonuses, loading: streaksLoading } = useStudentStreaks(child.id);

  return (
    <div className="space-y-6">
      {/* Child Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <AvatarDisplay avatarId={child.avatar_id} level={level.level} size="md" />
              <div>
                <h3 className="font-semibold text-lg">{child.full_name}</h3>
                <LevelBadge points={child.total_points} size="sm" showProgress />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/20 bg-gradient-to-br from-card to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Punti Totali</p>
                <PointsDisplay points={child.total_points} size="lg" />
              </div>
              <Trophy className="w-10 h-10 text-accent/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Livello</p>
                <p className="text-3xl font-bold text-foreground">{level.level}</p>
                <p className="text-sm text-muted-foreground">{level.name}</p>
              </div>
              <Award className="w-10 h-10 text-secondary/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Streaks Section */}
      {streaks && !streaksLoading && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            🔥 Streak di {child.full_name}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <StreakDisplay
                homeworkStreak={streaks.homework_streak}
                attendanceStreak={streaks.attendance_streak}
                bestHomeworkStreak={streaks.best_homework_streak}
                bestAttendanceStreak={streaks.best_attendance_streak}
              />
              {bonuses.length > 0 && (
                <StreakBonusesDisplay bonuses={bonuses} />
              )}
            </div>
            <AttendanceHistory attendance={attendance} stats={stats} />
          </div>
        </div>
      )}

      {/* Badges */}
      <BadgesDisplay userId={child.id} showAll={true} title={`🏆 Badge di ${child.full_name}`} />

      {/* Teacher Comments */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          Commenti degli Insegnanti
        </h3>

        {comments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center">
              <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Nessun commento ancora
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <Card key={comment.id} className="border-primary/20">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {comment.author?.full_name || 'Insegnante'}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(comment.created_at), "d MMM yyyy", { locale: it })}
                    </span>
                  </div>
                  <p className="text-sm">{comment.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
