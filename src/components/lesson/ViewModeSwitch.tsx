import type { LucideIcon } from 'lucide-react';
import { Backpack, GraduationCap, MonitorPlay, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreviewAudience } from '@/hooks/useLessonPreview';

interface SwitchOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
  /** Motivo per cui l'opzione non si può scegliere (mostrato come suggerimento) */
  disabledReason?: string;
}

interface ViewModeSwitchProps<T extends string> {
  value: T;
  options: SwitchOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  busy?: boolean;
  /** Su schermi stretti mostra solo le icone */
  compact?: boolean;
  className?: string;
}

/** Interruttore a schede (stile TabsList) tra due o più modalità di visualizzazione. */
export function ViewModeSwitch<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  busy,
  compact,
  className,
}: ViewModeSwitchProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex h-9 items-center rounded-md bg-muted p-1 text-muted-foreground', className)}
    >
      {options.map(option => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={compact ? option.label : undefined}
            disabled={busy || !!option.disabledReason}
            title={option.disabledReason ?? option.label}
            onClick={() => !active && onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
              'disabled:pointer-events-none disabled:opacity-50',
              active ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground',
            )}
          >
            <Icon className="w-4 h-4" />
            <span className={cn(compact && 'hidden sm:inline')}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

interface EditViewTabsProps {
  mode: 'edit' | 'view';
  onEdit?: () => void;
  onView?: () => void;
  /** Es. elemento non ancora salvato: la scheda "Visualizza" resta disattivata */
  viewDisabledReason?: string;
  busy?: boolean;
  compact?: boolean;
  className?: string;
}

/** Schede admin: "Modifica" (editor) oppure "Visualizza" (lezione come la vedono gli studenti). */
export function EditViewTabs({ mode, onEdit, onView, viewDisabledReason, busy, compact, className }: EditViewTabsProps) {
  return (
    <ViewModeSwitch
      value={mode}
      ariaLabel="Modalità"
      busy={busy}
      compact={compact}
      className={className}
      options={[
        { value: 'edit', label: 'Modifica', icon: Pencil },
        { value: 'view', label: 'Visualizza', icon: MonitorPlay, disabledReason: viewDisabledReason },
      ]}
      onChange={next => (next === 'edit' ? onEdit?.() : onView?.())}
    />
  );
}

/** Insegnante: materiale completo (task nascosti, soluzioni dei quiz) oppure come lo vedono gli studenti. */
export function AudienceSwitch({ value, onChange, compact, className }: {
  value: PreviewAudience;
  onChange: (value: PreviewAudience) => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <ViewModeSwitch
      value={value}
      ariaLabel="Vista"
      compact={compact}
      className={className}
      options={[
        { value: 'teacher', label: 'Insegnante', icon: GraduationCap },
        { value: 'student', label: 'Studente', icon: Backpack },
      ]}
      onChange={onChange}
    />
  );
}
