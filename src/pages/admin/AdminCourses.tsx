import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LogOut, Loader2, BookOpen, FileText, Mail, User, BarChart3, 
  GraduationCap, ChevronRight 
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  slug: string;
  emoji: string;
  level: string;
  total_lessons: number;
  description: string | null;
}

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAdmin, isLoading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (user && isAdmin) {
      fetchCourses();
    }
  }, [user, isAdmin]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('title');

    if (!error && data) {
      setCourses(data);
    }
    setIsLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

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
            <Badge variant="secondary">Admin</Badge>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/area-riservata">
                <User className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Esci
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="border-b bg-background">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-4 overflow-x-auto">
            <Link 
              to="/admin" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <FileText className="w-4 h-4" />
              Blog
            </Link>
            <Link 
              to="/admin/corsi" 
              className="py-3 px-2 border-b-2 border-primary text-primary font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <GraduationCap className="w-4 h-4" />
              Corsi
            </Link>
            <Link 
              to="/admin/prenotazioni" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4" />
              Prenotazioni
            </Link>
            <Link 
              to="/admin/contatti" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <Mail className="w-4 h-4" />
              Contatti
            </Link>
            <Link 
              to="/admin/utenti" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              Utenti
            </Link>
            <Link 
              to="/admin/statistiche" 
              className="py-3 px-2 text-muted-foreground hover:text-foreground flex items-center gap-2 whitespace-nowrap"
            >
              <BarChart3 className="w-4 h-4" />
              Statistiche
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Gestione Corsi</h1>
          <p className="text-muted-foreground mt-1">{courses.length} corsi totali</p>
        </div>

        {/* Courses Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{course.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate">{course.title}</CardTitle>
                    <CardDescription className="truncate">{course.slug}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline">{course.level}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {course.total_lessons} lezioni
                  </span>
                </div>
                <div className="space-y-2">
                  <Button asChild variant="default" className="w-full">
                    <Link to={`/admin/corsi/${course.id}/lezioni`}>
                      <BookOpen className="w-4 h-4 mr-2" />
                      Gestisci Lezioni
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
