import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AvatarDisplay } from '@/components/gamification/AvatarSelector';
import { LevelBadge, PointsDisplay, getLevelFromPoints } from '@/components/gamification/LevelBadge';
import { BadgesDisplay } from '@/components/gamification/BadgesDisplay';
import { HomeworkSection } from '@/components/dashboard/HomeworkSection';
import { ParentFeedbackSection } from '@/components/dashboard/ParentFeedbackSection';
import { StudentCommentsSection } from '@/components/dashboard/StudentCommentsSection';
import { ParentChildrenSection } from '@/components/dashboard/ParentChildrenSection';
import { Loader2, BookOpen, Trophy, Target, Settings, LogOut, Rocket, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CourseProgress {
  courseId: string;
  totalTasks: number;
  completedTasks: number;
}

export default function Dashboard() {
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const { profile, enrollments, lessonProgress, taskProgress, isLoading: dataLoading } = useStudentProgress();
  const navigate = useNavigate();
  const [courseProgressMap, setCourseProgressMap] = useState<CourseProgress[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Fetch task counts and completed tasks for all enrolled courses
  useEffect(() => {
    const fetchCourseProgress = async () => {
      if (enrollments.length === 0) return;

      const progressList: CourseProgress[] = [];
      const completedTaskIds = taskProgress.map(tp => tp.task_id);
      
      for (const enrollment of enrollments) {
        // Get all lessons for this course
        const { data: lessons } = await supabase
          .from('lessons')
          .select('id')
          .eq('course_id', enrollment.course.id);

        if (lessons && lessons.length > 0) {
          const lessonIds = lessons.map(l => l.id);
          
          // Get all tasks for all lessons in this course
          const { data: tasks } = await supabase
            .from('lesson_tasks')
            .select('id')
            .in('lesson_id', lessonIds);

          const totalTasks = tasks?.length || 0;
          const completedTasks = tasks?.filter(t => completedTaskIds.includes(t.id)).length || 0;

          progressList.push({
            courseId: enrollment.course.id,
            totalTasks,
            completedTasks
          });
        } else {
          progressList.push({
            courseId: enrollment.course.id,
            totalTasks: 0,
            completedTasks: 0
          });
        }
      }

      setCourseProgressMap(progressList);
    };

    fetchCourseProgress();
  }, [enrollments, taskProgress]);

  // Helper function to get course progress percentage
  const getCourseProgressPercent = (courseId: string) => {
    const progress = courseProgressMap.find(c => c.courseId === courseId);
    if (!progress || progress.totalTasks === 0) return 0;
    return Math.round((progress.completedTasks / progress.totalTasks) * 100);
  };

  if (authLoading || dataLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  // Handle missing profile case
  if (!profile) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Profilo non trovato</CardTitle>
              <CardDescription>
                Il tuo profilo utente non è stato trovato. Questo può accadere se il tuo account è stato creato prima del sistema di profili.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Contatta l'assistenza per risolvere il problema.
              </p>
              <div className="flex gap-2">
                {isAdmin && (
                  <Button asChild>
                    <Link to="/admin">Vai al Pannello Admin</Link>
                  </Button>
                )}
                <Button variant="outline" onClick={() => signOut()}>
                  Esci
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const level = getLevelFromPoints(profile.total_points);
  const completedLessons = lessonProgress.length;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-tech-green-light/20 to-tech-cyan-light/20">
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <AvatarDisplay 
                avatarId={profile.avatar_id} 
                level={level.level} 
                size="lg"
              />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  Ciao, {profile.full_name}! 👋
                </h1>
                <p className="text-muted-foreground">
                  Benvenuto nella tua area riservata
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin">
                    <Shield className="w-4 h-4 mr-2" />
                    Admin
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" asChild>
                <Link to="/area-riservata/profilo">
                  <Settings className="w-4 h-4 mr-2" />
                  Profilo
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Esci
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Livello Attuale</p>
                    <LevelBadge points={profile.total_points} size="md" showProgress />
                  </div>
                  <Trophy className="w-10 h-10 text-primary/30" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-accent/20 bg-gradient-to-br from-card to-accent/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Punti Totali</p>
                    <PointsDisplay points={profile.total_points} size="lg" />
                  </div>
                  <Target className="w-10 h-10 text-accent/30" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-secondary/20 bg-gradient-to-br from-card to-secondary/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Lezioni Completate</p>
                    <p className="text-3xl font-bold text-foreground">{completedLessons}</p>
                  </div>
                  <BookOpen className="w-10 h-10 text-secondary/30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Courses */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Rocket className="w-5 h-5 text-primary" />
              I Tuoi Corsi
            </h2>

            {enrollments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Nessun corso attivo
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Non sei ancora iscritto a nessun corso. Scopri i nostri corsi!
                  </p>
                  <Button asChild>
                    <Link to="/corsi">Esplora i Corsi</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enrollments.map((enrollment) => {
                  const course = enrollment.course;
                  const progressPercent = getCourseProgressPercent(course.id);
                  
                  return (
                    <Link 
                      key={enrollment.id} 
                      to={`/area-riservata/corso/${course.id}`}
                      className="block"
                    >
                      <Card className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-border/50">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-4xl">{course.emoji}</span>
                            <div className="flex-1">
                              <CardTitle className="text-lg">{course.title}</CardTitle>
                              <CardDescription>
                                {course.total_lessons} lezioni · Livello {course.level}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Avanzamento</span>
                              <span className="font-medium">{progressPercent}%</span>
                            </div>
                            <Progress value={progressPercent} className="h-2" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Badges Section */}
          {user && (
            <div className="mb-8">
              <BadgesDisplay userId={user.id} showAll={true} />
            </div>
          )}

          {/* Homework Section for Students */}
          <div className="mb-8">
            <HomeworkSection />
          </div>

          {/* Student Comments Section */}
          {user && (
            <div className="mb-8">
              <StudentCommentsSection />
            </div>
          )}

          {/* Parent Children Section - shows badges and progress for children */}
          <div className="mb-8">
            <ParentChildrenSection />
          </div>

          {/* Parent Feedback Section - only visible for parents */}
          <div className="mb-8">
            <ParentFeedbackSection />
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Azioni Rapide</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                  <Link to="/area-riservata/profilo">
                    <Settings className="w-5 h-5 mb-2" />
                    <span>Modifica Profilo</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                  <Link to="/corsi">
                    <BookOpen className="w-5 h-5 mb-2" />
                    <span>Tutti i Corsi</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                  <Link to="/prenota">
                    <Target className="w-5 h-5 mb-2" />
                    <span>Prenota Lezione</span>
                  </Link>
                </Button>
                <Button variant="outline" className="h-auto py-4 flex-col" asChild>
                  <Link to="/chi-siamo">
                    <Trophy className="w-5 h-5 mb-2" />
                    <span>Chi Siamo</span>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
