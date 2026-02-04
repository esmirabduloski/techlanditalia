import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, Users, Award } from "lucide-react";
import { LevelBadge, PointsDisplay, getLevelFromPoints } from "@/components/gamification/LevelBadge";
import { AvatarDisplay } from "@/components/gamification/AvatarSelector";
import { StreakDisplay } from "@/components/dashboard/StreakDisplay";
import { StreakBonusesDisplay } from "@/components/dashboard/StreakBonusesDisplay";
import { ParentBadgesSection } from "@/components/dashboard/ParentBadgesSection";
import { ParentCommentsSection } from "@/components/dashboard/ParentCommentsSection";
import { ChildLessonCalendar } from "@/components/dashboard/ChildLessonCalendar";
import { ChildHomeworkHistory } from "@/components/dashboard/ChildHomeworkHistory";
import { ChildAttendanceHistory } from "@/components/dashboard/ChildAttendanceHistory";
import { useStudentStreaks } from "@/hooks/useStudentStreaks";

interface Child {
  id: string;
  full_name: string;
  email: string | null;
  avatar_id: number;
  total_points: number;
}

export function ParentChildrenSection() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
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
          <TabsList className="mb-4 flex-wrap h-auto gap-2">
            {children.map(child => (
              <TabsTrigger key={child.id} value={child.id} className="gap-2">
                <AvatarDisplay avatarId={child.avatar_id} level={getLevelFromPoints(child.total_points).level} size="sm" />
                {child.full_name}
              </TabsTrigger>
            ))}
          </TabsList>

          {children.map(child => (
            <TabsContent key={child.id} value={child.id} className="space-y-6">
              <ChildDashboard child={child} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        activeChildData && <ChildDashboard child={activeChildData} />
      )}
    </div>
  );
}

function ChildDashboard({ child }: { child: Child }) {
  const level = getLevelFromPoints(child.total_points);
  const { streaks, bonuses, loading: streaksLoading } = useStudentStreaks(child.id);

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
          </div>
        </div>
      )}

      {/* Lesson Calendar */}
      <ChildLessonCalendar childId={child.id} childName={child.full_name} />

      {/* Attendance & Homework History side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChildAttendanceHistory childId={child.id} childName={child.full_name} />
        <ChildHomeworkHistory childId={child.id} childName={child.full_name} />
      </div>

      {/* Badges */}
      <ParentBadgesSection childId={child.id} childName={child.full_name} />

      {/* Teacher Comments */}
      <ParentCommentsSection childId={child.id} childName={child.full_name} />
    </div>
  );
}
