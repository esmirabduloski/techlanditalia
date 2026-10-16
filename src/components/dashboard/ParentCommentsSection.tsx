import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useChildComments } from "@/hooks/useChildProgressData";

interface ParentCommentsSectionProps {
  childId: string;
  childName: string;
}

const COMMENTS_PER_PAGE = 5;

/** Commenti degli insegnanti sul figlio, dal più recente. */
export function ParentCommentsSection({ childId, childName }: ParentCommentsSectionProps) {
  const { data: comments = [], isLoading } = useChildComments(childId);
  const [visibleCount, setVisibleCount] = useState(COMMENTS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="py-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <div className="py-4 text-center">
        <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Gli insegnanti non hanno ancora scritto commenti su {childName}</p>
      </div>
    );
  }

  const remaining = comments.length - visibleCount;

  return (
    <div className="space-y-3">
      <ul className="space-y-3 list-none p-0 m-0">
        {comments.slice(0, visibleCount).map((comment) => (
          <li key={comment.id} className="rounded-xl border border-primary/20 p-3">
            <p className="text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">{comment.author?.full_name || 'Insegnante'}</span>
              {' · '}
              {format(new Date(comment.created_at), "d MMM yyyy", { locale: it })}
            </p>
            <p className="text-sm whitespace-pre-line">{comment.content}</p>
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <Button variant="outline" className="w-full gap-2" onClick={() => setVisibleCount((n) => n + COMMENTS_PER_PAGE)}>
          <ChevronDown className="w-4 h-4" />
          Mostra altri ({remaining})
        </Button>
      )}
    </div>
  );
}
