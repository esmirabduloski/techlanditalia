import { useEffect, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudentProgress } from '@/hooks/useStudentProgress';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, ArrowLeft, CheckCircle2, Lock, PlayCircle, 
  BookOpen, ClipboardList, Trophy, Zap, ExternalLink
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  total_lessons: number;
  level: string;
}

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  content: string | null;
  points_reward: number;
}

interface Homework {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  points_reward: number;
}

export default function CourseProgress() {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { lessonProgress, homeworkSubmissions, taskProgress, completeLesson, refetch, effectiveUserId } = useStudentProgress();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [allTasks, setAllTasks] = useState<{ id: string; lesson_id: string }[]>([]);
  const [scheduleByLessonNumber, setScheduleByLessonNumber] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [completingLesson, setCompletingLesson] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId, effectiveUserId]);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!courseId || !effectiveUserId) return;
      // Find the student's group for this course
      const { data: groups } = await supabase
        .from('student_groups')
        .select('id, group_students!inner(student_id)')
        .eq('course_id', courseId)
        .eq('group_students.student_id', effectiveUserId);
      const groupIds = (groups || []).map((g: any) => g.id);
      if (groupIds.length === 0) {
        setScheduleByLessonNumber({});
        return;
      }
      const { data: sched } = await supabase
        .from('group_lesson_schedule')
        .select('lesson_number, lesson_date')
        .in('group_id', groupIds);
      const map: Record<number, string> = {};
      (sched || []).forEach((s: any) => {
        // Keep earliest date for each lesson_number if multiple groups
        if (!map[s.lesson_number] || s.lesson_date < map[s.lesson_number]) {
          map[s.lesson_number] = s.lesson_date;
        }
      });
      setScheduleByLessonNumber(map);
    };
    fetchSchedule();
  }, [courseId, effectiveUserId]);

  const fetchCourseData = async () => {
    if (!courseId) return;

    try {
      // Fetch course
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle();

      if (courseData) {
        setCourse(courseData);
      }

      // Fetch lessons
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', courseId)
        .order('lesson_number');

      if (lessonsData) {
        setLessons(lessonsData);

        // Fetch all tasks for these lessons to calculate progress
        const lessonIds = lessonsData.map(l => l.id);
        if (lessonIds.length > 0) {
          const { data: tasksData } = await supabase
            .from('lesson_tasks')
            .select('id, lesson_id')
            .in('lesson_id', lessonIds);

          if (tasksData) {
            setAllTasks(tasksData);
          }

          // Fetch homework for these lessons
          const { data: homeworkData } = await supabase
            .from('homework')
            .select('*')
            .in('lesson_id', lessonIds);

          if (homeworkData) {
            setHomework(homeworkData);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching course data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isLessonCompleted = (lessonId: string) => {
    return lessonProgress.some(p => p.lesson_id === lessonId);
  };

  const isHomeworkSubmitted = (homeworkId: string) => {
    return homeworkSubmissions.some(s => s.homework_id === homeworkId);
  };

  const getHomeworkStatus = (homeworkId: string) => {
    const submission = homeworkSubmissions.find(s => s.homework_id === homeworkId);
    return submission?.status || null;
  };

  const handleCompleteLesson = async (lesson: Lesson) => {
    setCompletingLesson(lesson.id);
    const success = await completeLesson(lesson.id);
    setCompletingLesson(null);

    if (success) {
      toast({
        title: '🎉 Lezione completata!',
        description: `Hai guadagnato ${lesson.points_reward} punti!`,
      });
      refetch();
    } else {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Non è stato possibile completare la lezione.',
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!user || !course) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">Corso non trovato</p>
              <Button asChild className="mt-4">
                <Link to="/area-riservata">Torna alla Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Calculate progress based on completed tasks
  const completedTasksCount = allTasks.filter(t => 
    taskProgress.some(p => p.task_id === t.id)
  ).length;
  const totalTasksCount = allTasks.length;
  const progressPercent = totalTasksCount > 0 
    ? Math.round((completedTasksCount / totalTasksCount) * 100) 
    : 0;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-background via-tech-green-light/20 to-tech-cyan-light/20">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/area-riservata">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{course.emoji}</span>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{course.title}</h1>
                  <p className="text-muted-foreground">{course.description}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Progress Overview */}
          <Card className="mb-6 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Avanzamento Corso</span>
                </div>
                <Badge variant={progressPercent === 100 ? 'default' : 'secondary'}>
                  {completedTasksCount}/{totalTasksCount} task
                </Badge>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {progressPercent === 100 
                  ? '🎉 Complimenti! Hai completato il corso!' 
                  : `${progressPercent}% completato - Continua così!`}
              </p>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="lessons" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="lessons" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Lezioni
              </TabsTrigger>
              <TabsTrigger value="homework" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Compiti
              </TabsTrigger>
            </TabsList>

            {/* Lessons Tab */}
            <TabsContent value="lessons" className="space-y-3">
              {lessons.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nessuna lezione disponibile</p>
                  </CardContent>
                </Card>
              ) : (
                lessons.map((lesson, index) => {
                  const completed = isLessonCompleted(lesson.id);
                  const isNext = !completed && lessons.slice(0, index).every(l => isLessonCompleted(l.id));
                  const isLocked = !completed && !isNext && index > 0;
                  const scheduledDate = scheduleByLessonNumber[lesson.lesson_number];
                  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
                  const isOnOrAfterScheduledDate = scheduledDate ? todayStr >= scheduledDate : false;
                  const canComplete = isNext && isOnOrAfterScheduledDate;

                    const cardContent = (
                      <CardContent className="py-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            completed 
                              ? 'bg-primary text-primary-foreground' 
                              : isNext 
                                ? 'bg-accent text-accent-foreground' 
                                : 'bg-muted text-muted-foreground'
                          }`}>
                            {completed ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : isLocked ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <span className="font-bold">{lesson.lesson_number}</span>
                            )}
                          </div>

                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground">
                              Lezione {lesson.lesson_number}: {lesson.title}
                            </h3>
                            {lesson.description && (
                              <p className="text-sm text-muted-foreground">{lesson.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-sm text-primary">
                              <Zap className="w-4 h-4" />
                              <span>{lesson.points_reward} pts</span>
                            </div>

                            {completed ? (
                              <Badge variant="outline" className="text-primary border-primary">
                                ✓ Completata
                              </Badge>
                            ) : canComplete ? (
                              <Button 
                                size="sm"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleCompleteLesson(lesson);
                                }}
                                disabled={completingLesson === lesson.id}
                              >
                                {completingLesson === lesson.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <PlayCircle className="w-4 h-4 mr-1" />
                                    Completa
                                  </>
                                )}
                              </Button>
                            ) : isNext && scheduledDate ? (
                              <Badge variant="secondary" title={`Disponibile dal ${new Date(scheduledDate).toLocaleDateString('it-IT')}`}>
                                <Lock className="w-3 h-3 mr-1" />
                                Dal {new Date(scheduledDate).toLocaleDateString('it-IT')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <Lock className="w-3 h-3 mr-1" />
                                Bloccata
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    );

                    // Se la lezione è accessibile (completata o sbloccata per data), rendi cliccabile
                    if (completed || canComplete) {
                      return (
                        <Link 
                          key={lesson.id}
                          to={`/area-riservata/corso/${courseId}/lezione/${lesson.lesson_number}`}
                          className="block"
                        >
                          <Card 
                            className={`transition-all cursor-pointer hover:shadow-lg ${
                              completed 
                                ? 'bg-primary/5 border-primary/30 hover:border-primary/50' 
                                : 'border-accent/50 shadow-md hover:border-accent'
                            }`}
                          >
                            {cardContent}
                          </Card>
                        </Link>
                      );
                    }

                    // Lezione bloccata - non cliccabile
                    return (
                      <Card 
                        key={lesson.id}
                        className="transition-all opacity-60"
                      >
                        {cardContent}
                      </Card>
                    );
                })
              )}
            </TabsContent>

            {/* Homework Tab */}
            <TabsContent value="homework" className="space-y-3">
              {homework.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center">
                    <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nessun compito disponibile</p>
                  </CardContent>
                </Card>
              ) : (
                lessons.map(lesson => {
                  const lessonHomework = homework.filter(h => h.lesson_id === lesson.id);
                  const lessonCompleted = isLessonCompleted(lesson.id);

                  if (lessonHomework.length === 0) return null;

                  return (
                    <div key={lesson.id} className="space-y-2">
                      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <span>📚</span>
                        Lezione {lesson.lesson_number}: {lesson.title}
                        {!lessonCompleted && (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Completa prima la lezione
                          </Badge>
                        )}
                      </h3>

                      {lessonHomework.map(hw => {
                        const submitted = isHomeworkSubmitted(hw.id);
                        const status = getHomeworkStatus(hw.id);
                        const isAccessible = lessonCompleted;

                        const homeworkCard = (
                          <Card 
                            className={`ml-4 transition-all ${
                              submitted 
                                ? 'bg-primary/5 border-primary/30' 
                                : !lessonCompleted 
                                  ? 'opacity-60' 
                                  : 'hover:shadow-lg hover:border-accent cursor-pointer'
                            }`}
                          >
                            <CardContent className="py-4">
                              <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                  submitted 
                                    ? 'bg-primary text-primary-foreground' 
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {submitted ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                  ) : (
                                    <ClipboardList className="w-4 h-4" />
                                  )}
                                </div>

                                <div className="flex-1">
                                  <h4 className="font-medium text-foreground">{hw.title}</h4>
                                  {hw.description && (
                                    <p className="text-sm text-muted-foreground">{hw.description}</p>
                                  )}
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1 text-sm text-accent">
                                    <Zap className="w-4 h-4" />
                                    <span>{hw.points_reward} pts</span>
                                  </div>

                                  {submitted ? (
                                    <Badge 
                                      variant={status === 'approved' ? 'default' : 'secondary'}
                                      className={status === 'approved' ? 'bg-primary' : ''}
                                    >
                                      {status === 'approved' ? '✓ Approvato' : status === 'reviewed' ? '👀 Revisionato' : '⏳ In attesa'}
                                    </Badge>
                                  ) : !lessonCompleted ? (
                                    <Badge variant="secondary">
                                      <Lock className="w-3 h-3 mr-1" />
                                      Bloccato
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-accent border-accent">
                                      <ExternalLink className="w-3 h-3 mr-1" />
                                      Apri
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );

                        // Se il compito è accessibile, rendilo cliccabile
                        if (isAccessible) {
                          return (
                            <Link 
                              key={hw.id}
                              to={`/area-riservata/compito/${hw.id}`}
                              className="block"
                            >
                              {homeworkCard}
                            </Link>
                          );
                        }

                        // Compito bloccato - non cliccabile
                        return (
                          <div key={hw.id}>
                            {homeworkCard}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
