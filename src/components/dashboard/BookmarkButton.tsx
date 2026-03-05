import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BookmarkButtonProps {
  isBookmarked: boolean;
  onToggle: () => void;
  size?: 'sm' | 'default';
  className?: string;
}

export function BookmarkButton({ isBookmarked, onToggle, size = 'default', className }: BookmarkButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size={size === 'sm' ? 'icon' : 'sm'}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
          className={cn(
            'transition-colors',
            isBookmarked && 'text-primary',
            className
          )}
        >
          {isBookmarked ? (
            <BookmarkCheck className={cn('fill-current', size === 'sm' ? 'w-4 h-4' : 'w-5 h-5')} />
          ) : (
            <Bookmark className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isBookmarked ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
      </TooltipContent>
    </Tooltip>
  );
}
