import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Bottone "← Indietro" ben visibile: bordo e testo verdi, freccia spessa.
 * Con `to` è un link, con `onClick` un bottone.
 */
type BackButtonProps = {
  label?: string;
  className?: string;
  'aria-label'?: string;
} & ({ to: string; onClick?: never } | { onClick: () => void; to?: never });

const backButtonClass =
  'inline-flex shrink-0 items-center gap-2 min-h-11 rounded-lg border-2 border-primary bg-background px-3 sm:px-4 ' +
  'text-base font-bold text-primary shadow-sm transition-colors hover:bg-primary/10 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function BackButton({ label = 'Indietro', className, 'aria-label': ariaLabel, ...props }: BackButtonProps) {
  const content = (
    <>
      <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={3} aria-hidden="true" />
      <span>{label}</span>
    </>
  );

  if (props.to) {
    return (
      <Link to={props.to} aria-label={ariaLabel} className={cn(backButtonClass, className)}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={props.onClick} aria-label={ariaLabel} className={cn(backButtonClass, className)}>
      {content}
    </button>
  );
}
