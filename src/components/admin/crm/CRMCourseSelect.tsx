import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCourseOptions } from "@/hooks/useCourseOptions";

const NONE = "__none__";

interface Props {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "default";
  allowNone?: boolean;
}

/** Menu a tendina dei corsi, usato per assegnare l'interesse a un lead CRM. */
export function CRMCourseSelect({
  value,
  onChange,
  placeholder = "Seleziona un corso",
  className,
  size = "default",
  allowNone = true,
}: Props) {
  const { courses } = useCourseOptions();

  // Se il valore salvato non corrisponde a un titolo esistente, lo mostriamo comunque.
  const known = courses.some((c) => c.title === value);
  const current = value ? value : NONE;

  return (
    <Select
      value={current}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
    >
      <SelectTrigger className={`${size === "sm" ? "h-8 text-xs" : ""} ${className ?? ""}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>Nessun corso</SelectItem>}
        {!known && value && <SelectItem value={value}>{value}</SelectItem>}
        {courses.map((c) => (
          <SelectItem key={c.id} value={c.title}>
            {c.emoji ? `${c.emoji} ` : ""}
            {c.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
