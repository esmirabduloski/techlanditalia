import { Link } from 'react-router-dom';
import { PlayCircle } from 'lucide-react';

/** Card del corso nella home: apre il tutorial (video + guida PDF). */
export function CourseTutorialButton({ courseId }: { courseId: string }) {
  return (
    <Link
      to={`/area-riservata/corso/${courseId}/tutorial-compiti`}
      className="flex w-full min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-primary/40 bg-background px-4 text-sm sm:text-base font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <PlayCircle className="w-5 h-5 shrink-0" aria-hidden="true" />
      Tutorial: come consegnare i compiti
    </Link>
  );
}
