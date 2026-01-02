import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Loader2, ArrowLeft, BookOpen, Download, ExternalLink, FileText, Presentation
} from "lucide-react";

interface Lesson {
  id: string;
  lesson_number: number;
  title: string;
  description: string | null;
  slides_url: string | null;
  manual_url: string | null;
}

interface Course {
  id: string;
  title: string;
  emoji: string;
  description: string | null;
  total_lessons: number;
}

export default function TeacherCourseDetail() {
  const { courseId } = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [course, setCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, courseId]);

  const fetchData = async () => {
    try {
      // Verify teacher has access to this course
      const { data: teacherCourse } = await supabase
        .from('teacher_courses')
        .select('course_id')
        .eq('teacher_id', user!.id)
        .eq('course_id', courseId)
        .maybeSingle();

      if (!teacherCourse) {
        navigate('/insegnante');
        return;
      }

      // Fetch course
      const { data: courseData } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      setCourse(courseData);

      // Fetch lessons
      const { data: lessonsData } = await supabase
        .from('lessons')
        .select('id, lesson_number, title, description, slides_url, manual_url')
        .eq('course_id', courseId)
        .order('lesson_number');

      setLessons(lessonsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!course) return null;

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Lezioni ({lessons.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <div className="text-center py-8">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nessuna lezione disponibile</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lessons.map(lesson => (
                  <div key={lesson.id} className="border rounded-lg">
                    <div 
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                      onClick={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{lesson.lesson_number}</Badge>
                        <span className="font-medium">{lesson.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {lesson.slides_url && (
                          <Badge variant="secondary" className="text-xs">
                            <Presentation className="w-3 h-3 mr-1" />
                            PPT
                          </Badge>
                        )}
                        {lesson.manual_url && (
                          <Badge variant="secondary" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            Manuale
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    {expandedLesson === lesson.id && (
                      <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
                        {lesson.description && (
                          <p className="text-sm text-muted-foreground mb-4">{lesson.description}</p>
                        )}
                        
                        <div className="flex flex-wrap gap-3">
                          {lesson.slides_url && (
                            <Button asChild size="sm">
                              <a href={lesson.slides_url} target="_blank" rel="noopener noreferrer">
                                <Download className="w-4 h-4 mr-2" />
                                Scarica Presentazione
                              </a>
                            </Button>
                          )}
                          {lesson.manual_url && (
                            <Button variant="outline" asChild size="sm">
                              <a href={lesson.manual_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Apri Manuale
                              </a>
                            </Button>
                          )}
                          {!lesson.slides_url && !lesson.manual_url && (
                            <p className="text-sm text-muted-foreground">
                              Nessun materiale disponibile per questa lezione
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
