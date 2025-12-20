import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, User, Calendar } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface FeedbackItem {
  id: string;
  homework_title: string;
  teacher_feedback: string;
  feedback_at: string;
  student_name: string;
  course_title: string;
  course_emoji: string;
  points_earned: number;
}

export function ParentFeedbackSection() {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isParent, setIsParent] = useState(false);

  useEffect(() => {
    if (user) {
      checkParentAndFetchFeedback();
    }
  }, [user]);

  const checkParentAndFetchFeedback = async () => {
    if (!user) return;

    try {
      // Check if user is a parent (has children linked to them)
      const { data: children } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("parent_id", user.id);

      if (!children || children.length === 0) {
        setIsParent(false);
        setIsLoading(false);
        return;
      }

      setIsParent(true);
      const childIds = children.map((c) => c.id);
      const childNameMap = new Map(children.map((c) => [c.id, c.full_name]));

      // Fetch homework submissions with teacher feedback for children
      const { data: submissions } = await supabase
        .from("homework_submissions")
        .select(`
          id,
          teacher_feedback,
          feedback_at,
          points_earned,
          student_id,
          homework:homework_id (
            title,
            lesson:lesson_id (
              course:course_id (
                title,
                emoji
              )
            )
          )
        `)
        .in("student_id", childIds)
        .not("teacher_feedback", "is", null)
        .order("feedback_at", { ascending: false })
        .limit(10);

      if (!submissions) {
        setFeedbacks([]);
        setIsLoading(false);
        return;
      }

      const feedbackItems: FeedbackItem[] = submissions
        .filter((s) => s.teacher_feedback && s.homework)
        .map((s) => {
          const homework = s.homework as { 
            title: string; 
            lesson: { course: { title: string; emoji: string } } | null 
          };
          const course = homework?.lesson?.course;
          
          return {
            id: s.id,
            homework_title: homework?.title || "Compito",
            teacher_feedback: s.teacher_feedback!,
            feedback_at: s.feedback_at || new Date().toISOString(),
            student_name: childNameMap.get(s.student_id) || "Studente",
            course_title: course?.title || "Corso",
            course_emoji: course?.emoji || "📚",
            points_earned: s.points_earned,
          };
        });

      setFeedbacks(feedbackItems);
    } catch (error) {
      console.error("Error fetching feedback:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show section if not a parent
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

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary" />
        Commenti dell'Insegnante
      </h2>

      {feedbacks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Non ci sono ancora commenti dell'insegnante
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              I feedback verranno mostrati qui quando l'insegnante valuterà i compiti
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((feedback) => (
            <Card key={feedback.id} className="border-primary/20 bg-gradient-to-r from-card to-primary/5">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{feedback.course_emoji}</span>
                    <div>
                      <CardTitle className="text-base">{feedback.homework_title}</CardTitle>
                      <CardDescription className="text-xs flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {feedback.student_name}
                        </span>
                        <span>·</span>
                        <span>{feedback.course_title}</span>
                      </CardDescription>
                    </div>
                  </div>
                  {feedback.points_earned > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      +{feedback.points_earned} punti
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-3 mb-2">
                  <p className="text-sm text-foreground italic">
                    "{feedback.teacher_feedback}"
                  </p>
                </div>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3 mr-1" />
                  {format(new Date(feedback.feedback_at), "d MMMM yyyy", { locale: it })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
