import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Loader2, User, Calendar, Eye } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Comment {
  id: string;
  content: string;
  visibility: string[];
  created_at: string;
  author: {
    full_name: string;
    role: string;
  };
  student: {
    full_name: string;
  };
}

interface StudentCommentsSectionProps {
  studentId?: string; // If provided, shows comments for this student (for parents)
  viewMode?: 'student' | 'parent'; // Which perspective to show
}

export function StudentCommentsSection({ studentId, viewMode = 'student' }: StudentCommentsSectionProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchComments();
    }
  }, [user, studentId]);

  const fetchComments = async () => {
    if (!user) return;

    try {
      const targetId = studentId || user.id;
      
      const { data, error } = await supabase
        .from("student_comments")
        .select(`
          id,
          content,
          visibility,
          created_at,
          author:author_id (full_name, role),
          student:student_id (full_name)
        `)
        .eq("student_id", targetId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Defense-in-depth: filter by visibility based on viewMode
      const requiredVisibility = viewMode === 'parent' ? 'parent' : 'student';
      const filtered = (data || []).filter((c: any) =>
        Array.isArray(c.visibility) && c.visibility.includes(requiredVisibility)
      );

      const typedComments = filtered.map((c: any) => ({
        id: c.id,
        content: c.content,
        visibility: c.visibility,
        created_at: c.created_at,
        author: c.author as { full_name: string; role: string },
        student: c.student as { full_name: string },
      }));

      setComments(typedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const getVisibilityLabel = (visibility: string[]) => {
    const labels = [];
    if (visibility.includes('parent')) labels.push('Genitore');
    if (visibility.includes('teacher')) labels.push('Insegnante');
    if (visibility.includes('student')) labels.push('Studente');
    return labels.join(', ');
  };

  const getVisibilityColor = (visibility: string[]) => {
    if (visibility.includes('student')) return 'default';
    if (visibility.includes('parent')) return 'secondary';
    return 'outline';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-primary" />
        {viewMode === 'parent' ? 'Commenti degli Insegnanti' : 'Commenti sul tuo Percorso'}
      </h2>

      {comments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <MessageCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Nessun commento ancora
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Gli insegnanti aggiungeranno commenti sul tuo percorso
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <Card key={comment.id} className="border-primary/20">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <CardTitle className="text-base">
                      {comment.author?.full_name || 'Insegnante'}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs capitalize">
                      {comment.author?.role || 'teacher'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="w-3 h-3" />
                    <span>{getVisibilityLabel(comment.visibility)}</span>
                  </div>
                </div>
                {viewMode === 'parent' && (
                  <CardDescription className="text-xs">
                    Per: {comment.student?.full_name}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-3 mb-2">
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1" />
                  {format(new Date(comment.created_at), "d MMMM yyyy 'alle' HH:mm", { locale: it })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
