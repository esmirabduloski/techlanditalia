import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, Calendar, ChevronDown } from "lucide-react";
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
}

interface ParentCommentsSectionProps {
  childId: string;
  childName: string;
}

const COMMENTS_PER_PAGE = 5;

export function ParentCommentsSection({ childId, childName }: ParentCommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(COMMENTS_PER_PAGE);

  useEffect(() => {
    if (childId) {
      fetchComments();
    }
  }, [childId]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from("student_comments")
        .select(`
          id,
          content,
          visibility,
          created_at,
          author:author_id (full_name, role)
        `)
        .eq("student_id", childId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const typedComments = (data || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        visibility: c.visibility,
        created_at: c.created_at,
        author: c.author as { full_name: string; role: string },
      }));

      setComments(typedComments);
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowMore = () => {
    setVisibleCount(prev => prev + COMMENTS_PER_PAGE);
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

  const visibleComments = comments.slice(0, visibleCount);
  const hasMore = comments.length > visibleCount;
  const remainingCount = comments.length - visibleCount;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-primary" />
        Commenti degli Insegnanti per {childName}
      </h3>

      {comments.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nessun commento ancora
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {visibleComments.map((comment) => (
              <Card key={comment.id} className="border-primary/20">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">
                      {comment.author?.full_name || 'Insegnante'}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(comment.created_at), "d MMM yyyy", { locale: it })}
                    </span>
                  </div>
                  <p className="text-sm">{comment.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleShowMore}
                className="gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                Mostra altri ({Math.min(remainingCount, COMMENTS_PER_PAGE)} di {remainingCount})
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
