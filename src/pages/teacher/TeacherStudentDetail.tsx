import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Loader2, ArrowLeft, User, BookOpen, Users, MessageCircle, Mail, Calendar, Plus, Send
} from "lucide-react";
import { AvatarDisplay } from "@/components/gamification/AvatarSelector";
import { LevelBadge, getLevelFromPoints } from "@/components/gamification/LevelBadge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

// Component to show comments for a student from teacher's view
function TeacherCommentsView({ studentId }: { studentId: string }) {
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchComments();
  }, [studentId]);

  const fetchComments = async () => {
    try {
      // First get comments
      const { data: commentsData, error } = await supabase
        .from('student_comments')
        .select('id, content, visibility, created_at, author_id')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (commentsData && commentsData.length > 0) {
        // Get author names separately
        const authorIds = [...new Set(commentsData.map(c => c.author_id))];
        const { data: authors } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', authorIds);

        const authorMap: Record<string, { full_name: string; role: string }> = {};
        authors?.forEach(a => { authorMap[a.id] = { full_name: a.full_name, role: a.role }; });

        setComments(commentsData.map(c => ({
          ...c,
          author: authorMap[c.author_id] || { full_name: 'Insegnante', role: 'teacher' }
        })));
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
      setComments([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>Nessun commento ancora</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <div key={comment.id} className="p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">{comment.author?.full_name}</span>
            <Badge variant="outline" className="text-xs">{comment.author?.role}</Badge>
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          <p className="text-xs text-muted-foreground mt-2">
            {format(new Date(comment.created_at), "d MMM yyyy 'alle' HH:mm", { locale: it })}
          </p>
        </div>
      ))}
    </div>
  );
}

interface StudentProfile {
  id: string;
  full_name: string;
  email: string | null;
  avatar_id: number;
  total_points: number;
  created_at: string;
  parent_id: string | null;
}

interface Parent {
  id: string;
  full_name: string;
  email: string | null;
}

interface Enrollment {
  id: string;
  course_id: string;
  status: string;
  course_title: string;
  course_emoji: string;
}

interface GroupMembership {
  id: string;
  group_title: string;
  course_title: string;
}

export default function TeacherStudentDetail() {
  const { studentId } = useParams();
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const { effectiveUserId, isImpersonating } = useEffectiveUserId();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [parent, setParent] = useState<Parent | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [groups, setGroups] = useState<GroupMembership[]>([]);
  
  // Comment dialog state
  const [isCommentDialogOpen, setIsCommentDialogOpen] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<string[]>(['parent', 'teacher']);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    } else if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, studentId, effectiveUserId]);

  const fetchData = async () => {
    if (!effectiveUserId) return;
    
    const teacherId = effectiveUserId;
    
    try {
      // Verify teacher has access to this student (student is in one of their groups)
      // Admin can bypass this check
      if (!isAdmin) {
        const { data: teacherGroups } = await supabase
          .from('student_groups')
          .select('id')
          .eq('teacher_id', teacherId);

        if (!teacherGroups || teacherGroups.length === 0) {
          navigate('/insegnante');
          return;
        }

        const { data: studentInGroup } = await supabase
          .from('group_students')
          .select('group_id')
          .eq('student_id', studentId)
          .in('group_id', teacherGroups.map(g => g.id))
          .limit(1);

        if (!studentInGroup || studentInGroup.length === 0) {
          navigate('/insegnante');
          return;
        }
      }

      // Fetch student profile
      const { data: studentData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single();

      setStudent(studentData);

      // Fetch parent if exists
      if (studentData?.parent_id) {
        const { data: parentData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', studentData.parent_id)
          .single();
        
        setParent(parentData);
      }

      // Fetch enrollments with course info
      const { data: enrollmentsData } = await supabase
        .from('enrollments')
        .select(`
          id, course_id, status,
          courses!inner(title, emoji)
        `)
        .eq('student_id', studentId);

      if (enrollmentsData) {
        setEnrollments(enrollmentsData.map((e: any) => ({
          id: e.id,
          course_id: e.course_id,
          status: e.status,
          course_title: e.courses?.title,
          course_emoji: e.courses?.emoji
        })));
      }

      // Fetch group memberships
      const { data: groupsData } = await supabase
        .from('group_students')
        .select(`
          id, group_id,
          student_groups!inner(title, courses!inner(title))
        `)
        .eq('student_id', studentId);

      if (groupsData) {
        setGroups(groupsData.map((g: any) => ({
          id: g.id,
          group_title: g.student_groups?.title,
          course_title: g.student_groups?.courses?.title
        })));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentContent.trim() || !user || !studentId) return;

    setIsSavingComment(true);
    try {
      const { error } = await supabase
        .from('student_comments')
        .insert({
          student_id: studentId,
          author_id: user.id,
          content: commentContent.trim(),
          visibility: commentVisibility
        });

      if (error) throw error;

      toast({ title: 'Commento aggiunto', description: 'Il commento è stato salvato con successo' });
      setCommentContent('');
      setCommentVisibility(['parent', 'teacher']);
      setIsCommentDialogOpen(false);
      setRefreshKey(prev => prev + 1);
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingComment(false);
    }
  };

  const toggleVisibility = (value: string) => {
    setCommentVisibility(prev => 
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) return null;

  const activeEnrollments = enrollments.filter(e => e.status === 'active');
  const completedEnrollments = enrollments.filter(e => e.status === 'completed');

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
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Indietro
        </Button>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Student Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <AvatarDisplay 
                    avatarId={student.avatar_id} 
                    level={getLevelFromPoints(student.total_points).level} 
                    size="lg" 
                  />
                  <h2 className="text-xl font-bold mt-4">{student.full_name}</h2>
                  <LevelBadge points={student.total_points} size="md" showProgress />
                  <div className="mt-4 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2 justify-center">
                      <Calendar className="w-4 h-4" />
                      Iscritto dal {new Date(student.created_at).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parent Info */}
            {parent && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Genitore
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">{parent.full_name}</p>
                    {parent.email && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {parent.email}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Groups */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Gruppi
                </CardTitle>
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun gruppo</p>
                ) : (
                  <div className="space-y-2">
                    {groups.map(g => (
                      <div key={g.id} className="p-2 bg-muted rounded">
                        <p className="font-medium text-sm">{g.group_title}</p>
                        <p className="text-xs text-muted-foreground">{g.course_title}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Courses */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Corsi
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeEnrollments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm text-muted-foreground">Corsi Attivi</h4>
                    <div className="flex flex-wrap gap-2">
                      {activeEnrollments.map(e => (
                        <Badge key={e.id} variant="secondary">
                          {e.course_emoji} {e.course_title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {completedEnrollments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-sm text-muted-foreground">Corsi Completati</h4>
                    <div className="flex flex-wrap gap-2">
                      {completedEnrollments.map(e => (
                        <Badge key={e.id} variant="outline" className="text-green-600">
                          {e.course_emoji} {e.course_title}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {enrollments.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nessun corso</p>
                )}
              </CardContent>
            </Card>

            {/* Comments */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Commenti
                </CardTitle>
                <Button onClick={() => setIsCommentDialogOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Commento
                </Button>
              </CardHeader>
              <CardContent>
                <TeacherCommentsView key={refreshKey} studentId={student.id} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Add Comment Dialog */}
      <Dialog open={isCommentDialogOpen} onOpenChange={setIsCommentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Commento per {student?.full_name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Commento</Label>
              <Textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Scrivi un commento sullo studente..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Visibilità</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vis-parent"
                    checked={commentVisibility.includes('parent')}
                    onCheckedChange={() => toggleVisibility('parent')}
                  />
                  <label htmlFor="vis-parent" className="text-sm">Genitore</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vis-teacher"
                    checked={commentVisibility.includes('teacher')}
                    onCheckedChange={() => toggleVisibility('teacher')}
                  />
                  <label htmlFor="vis-teacher" className="text-sm">Insegnanti</label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vis-student"
                    checked={commentVisibility.includes('student')}
                    onCheckedChange={() => toggleVisibility('student')}
                  />
                  <label htmlFor="vis-student" className="text-sm">Studente</label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Seleziona chi può vedere questo commento
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCommentDialogOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={handleAddComment} 
              disabled={isSavingComment || !commentContent.trim()}
            >
              {isSavingComment ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Invia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}