import { Skeleton } from '@/components/ui/skeleton';

/** Segnaposto della pagina lezione/task durante il primo caricamento. */
export function LessonPageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8" aria-busy="true" aria-label="Caricamento lezione">
      <div className="rounded-xl border border-border p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-5 w-64 max-w-full" />
          </div>
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-8 h-8 rounded-full" />
          ))}
        </div>
      </div>
      <div className="p-6 space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
