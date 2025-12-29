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
import { FileUpload } from '@/components/homework/FileUpload';
import { 
  Loader2, ArrowLeft, CheckCircle2, Lock, PlayCircle, 
  BookOpen, ClipboardList, Trophy, Zap, ExternalLink, Upload
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
  const { lessonProgress, homeworkSubmissions, completeLesson, submitHomework, refetch } = useStudentProgress();
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completingLesson, setCompletingLesson] = useState<string | null>(null);
  const [submittingHomework, setSubmittingHomework] = useState<string | null>(null);
  const [uploadingHomeworkId, setUploadingHomeworkId] = useState<string | null>(null);
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
  }, [courseId]);

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

        // Fetch homework for these lessons
        const lessonIds = lessonsData.map(l => l.id);
        if (lessonIds.length > 0) {
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

  const handleSubmitHomework = async (hw: Homework, fileUrl?: string, fileName?: string, fileType?: string) => {
    setSubmittingHomework(hw.id);
    const success = await submitHomework(hw.id, fileUrl, fileName, fileType);
    setSubmittingHomework(null);
    setUploadingHomeworkId(null);

    if (success) {
      toast({
        title: '📝 Compito consegnato!',
        description: `Hai guadagnato ${hw.points_reward} punti!`,
      });
      refetch();
    } else {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Non è stato possibile consegnare il compito.',
      });
    }
  };

  const handleFileUploaded = (hw: Homework, fileUrl: string, fileName: string, fileType: string) => {
    handleSubmitHomework(hw, fileUrl, fileName, fileType);
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

  const completedLessons = lessons.filter(l => isLessonCompleted(l.id)).length;
  const progressPercent = lessons.length > 0 
    ? Math.round((completedLessons / lessons.length) * 100) 
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
                  {completedLessons}/{lessons.length} lezioni
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
                            ) : isNext ? (
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

                    // Se la lezione è accessibile, rendi l'intera card cliccabile
                    if (completed || isNext) {
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

                        return (
                          <Card 
                            key={hw.id}
                            className={`ml-4 ${
                              submitted 
                                ? 'bg-primary/5 border-primary/30' 
                                : !lessonCompleted 
                                  ? 'opacity-60' 
                                  : ''
                            }`}
                          >
                            <CardContent className="py-4">
                              <div className="flex flex-col gap-4">
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
                                    {hw.instructions && (
                                      <p className="text-xs text-muted-foreground mt-1 italic">{hw.instructions}</p>
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
                                    ) : uploadingHomeworkId === hw.id ? null : (
                                      <Button 
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setUploadingHomeworkId(hw.id)}
                                      >
                                        <Upload className="w-4 h-4 mr-1" />
                                        Carica file
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* File Upload Area */}
                                {lessonCompleted && !submitted && uploadingHomeworkId === hw.id && (
                                  <div className="ml-12 space-y-3">
                                    <FileUpload
                                      onFileUploaded={(fileUrl, fileName, fileType) => 
                                        handleFileUploaded(hw, fileUrl, fileName, fileType)
                                      }
                                    />
                                    <div className="flex gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => setUploadingHomeworkId(null)}
                                      >
                                        Annulla
                                      </Button>
                                      <Button 
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleSubmitHomework(hw)}
                                        disabled={submittingHomework === hw.id}
                                      >
                                        {submittingHomework === hw.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          'Consegna senza file'
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
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
