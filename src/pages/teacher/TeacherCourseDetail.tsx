import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherCourseAccess } from "@/hooks/useTeacherCourseAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, ArrowLeft, BookOpen, FileText, Play, ClipboardList
} from "lucide-react";

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  has_tasks: boolean;
}

interface Homework {
  id: string;
  title: string;
  description: string | null;
  points_reward: number;
  lesson_number: number;
  lesson_title: string;
}

interface Course {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string | null;
  total_lessons: number;
}

export default function TeacherCourseDetail() {
  const { courseSlug } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const { hasAccess, isLoading: accessLoading, courseId } = useTeacherCourseAccess(courseSlug);
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [homeworks, setHomeworks] = useState<Homework[]>([]);

  useEffect(() => {
    if (!authLoading && !accessLoading && hasAccess && courseId) {
      fetchData();
    } else if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && !accessLoading && !hasAccess && user) {
      navigate('/insegnante');
    }
  }, [user, authLoading, accessLoading, hasAccess, courseId]);

  const fetchData = async () => {
    if (!courseId) return;
    
    try {
      // Fetch course
      const { data: courseData } = await supabase
        .from('courses')
        .select('id, slug, title, emoji, description, total_lessons')
        .eq('id', courseId)
        .single();

      setCourse(courseData);

      // Fetch lessons
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, lesson_number, title, description')
        .eq('course_id', courseId)
        .order('lesson_number');

      // Check which lessons have tasks
      const lessonsWithTaskInfo = await Promise.all(
        (lessonsData || []).map(async (lesson) => {
          const { count } = await supabase
            .from('lesson_tasks')
            .select('*', { count: 'exact', head: true })
            .eq('lesson_id', lesson.id);
          return { ...lesson, has_tasks: (count || 0) > 0 };
        })
      );

      setLessons(lessonsWithTaskInfo);

      // Fetch homeworks for this course
      const { data: homeworksData } = await supabase
        .from('homework')
        .select(`
          id,
          title,
          description,
          points_reward,
          lessons!inner (
            lesson_number,
            title,
            course_id
          )
        `)
        .eq('lessons.course_id', courseId);

      if (homeworksData) {
        const mappedHomeworks: Homework[] = homeworksData.map((hw: any) => ({
          id: hw.id,
          title: hw.title,
          description: hw.description,
          points_reward: hw.points_reward,
          lesson_number: hw.lessons.lesson_number,
          lesson_title: hw.lessons.title,
        }));
        setHomeworks(mappedHomeworks.sort((a, b) => a.lesson_number - b.lesson_number));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || accessLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) return null;

  const navigateToLesson = (lessonNumber: number) => {
    navigate(`/insegnante/corso/${courseSlug}/lezione/${lessonNumber}`);
  };

  const navigateToHomework = (homeworkId: string) => {
    navigate(`/insegnante/corso/${courseSlug}/compito/${homeworkId}`);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-2xl font-bold">
              <span className="text-primary">TECH</span>
              <span className="text-tech-teal">LAND</span>
            </Link>
            <Badge className="bg-tech-teal text-white">Insegnante</Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => navigate('/insegnante')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Torna alla Dashboard
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <span className="text-4xl">{course.emoji}</span>
            {course.title}
          </h1>
          {course.description && (
            <p className="text-muted-foreground mt-2">{course.description}</p>
          )}
        </div>

        <Tabs defaultValue="lessons" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="lessons" className="gap-2">
              <BookOpen className="w-4 h-4" />
              Lezioni ({lessons.length})
            </TabsTrigger>
            <TabsTrigger value="homework" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Compiti ({homeworks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lessons">
            <Card>
              <CardContent className="pt-6">
                {lessons.length === 0 ? (
                  <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nessuna lezione disponibile</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lessons.map(lesson => (
                      <div 
                        key={lesson.id} 
                        className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                        onClick={() => navigateToLesson(lesson.lesson_number)}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{lesson.lesson_number}</Badge>
                          <div>
                            <span className="font-medium">{lesson.title}</span>
                            {lesson.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{lesson.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {lesson.has_tasks && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <FileText className="w-3 h-3" />
                              Task
                            </Badge>
                          )}
                          <Play className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="homework">
            <Card>
              <CardContent className="pt-6">
                {homeworks.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nessun compito disponibile</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {homeworks.map(hw => (
                      <div 
                        key={hw.id} 
                        className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                        onClick={() => navigateToHomework(hw.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">L{hw.lesson_number}</Badge>
                          <div>
                            <span className="font-medium">{hw.title}</span>
                            <p className="text-sm text-muted-foreground">
                              {hw.lesson_title}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{hw.points_reward} punti</Badge>
                          <Play className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}