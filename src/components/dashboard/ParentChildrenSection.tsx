import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trophy, Users, Award, BookOpen } from "lucide-react";
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

interface ChildCourse {
  courseId: string;
  courseTitle: string;
  courseEmoji: string;
  groupIds: string[];
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
  const [courses, setCourses] = useState<ChildCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [coursesLoading, setCoursesLoading] = useState(true);

  useEffect(() => {
    fetchChildCourses();
  }, [child.id]);

  const fetchChildCourses = async () => {
    setCoursesLoading(true);
    try {
      const { data: groupStudentData } = await supabase
        .from("group_students")
        .select(`
          group_id,
          group:group_id (
            id,
            course_id,
            course:course_id (
              id,
              title,
              emoji
            )
          )
        `)
        .eq("student_id", child.id);

      if (groupStudentData && groupStudentData.length > 0) {
        // Group by course
        const courseMap = new Map<string, ChildCourse>();
        groupStudentData.forEach((gs: any) => {
          const courseId = gs.group.course.id;
          if (!courseMap.has(courseId)) {
            courseMap.set(courseId, {
              courseId,
              courseTitle: gs.group.course.title,
              courseEmoji: gs.group.course.emoji,
              groupIds: [],
            });
          }
          courseMap.get(courseId)!.groupIds.push(gs.group.id);
        });

        const courseList = Array.from(courseMap.values());
        setCourses(courseList);
        if (courseList.length > 0) {
          setSelectedCourseId(courseList[0].courseId);
        }
      } else {
        setCourses([]);
      }
    } catch (error) {
      console.error("Error fetching child courses:", error);
    } finally {
      setCoursesLoading(false);
    }
  };

  const selectedCourse = courses.find(c => c.courseId === selectedCourseId);

  return (
    <div className="space-y-6">
      {/* Child Stats - always visible (global) */}
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

      {/* Badges - global */}
      <ParentBadgesSection childId={child.id} childName={child.full_name} />

      {/* Course Selector */}
      {!coursesLoading && courses.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Dati per Corso</h3>
            {courses.length > 1 && (
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(course => (
                    <SelectItem key={course.courseId} value={course.courseId}>
                      {course.courseEmoji} {course.courseTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {courses.length === 1 && (
              <span className="text-muted-foreground">
                {courses[0].courseEmoji} {courses[0].courseTitle}
              </span>
            )}
          </div>

          {selectedCourse && (
            <div className="space-y-6">
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

              {/* Lesson Calendar - filtered by course */}
              <ChildLessonCalendar
                childId={child.id}
                childName={child.full_name}
                groupIds={selectedCourse.groupIds}
              />

              {/* Attendance & Homework History side by side - filtered by course */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChildAttendanceHistory
                  childId={child.id}
                  childName={child.full_name}
                  groupIds={selectedCourse.groupIds}
                />
                <ChildHomeworkHistory
                  childId={child.id}
                  childName={child.full_name}
                  courseIds={[selectedCourse.courseId]}
                />
              </div>

              {/* Teacher Comments */}
              <ParentCommentsSection childId={child.id} childName={child.full_name} />
            </div>
          )}
        </div>
      )}

      {coursesLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {!coursesLoading && courses.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nessun corso attivo per {child.full_name}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
