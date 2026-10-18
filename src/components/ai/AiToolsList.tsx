import { AI_TOOLS } from '@/lib/aiConsents';

/** Cosa fanno gli strumenti AI e dove vanno i dati: la parte dell'informativa che cambia con la versione. */
export function AiToolsList({ compact }: { compact?: boolean }) {
  if (AI_TOOLS.length === 0) return null;
  return (
    <ul className="space-y-2 list-disc pl-4">
      {AI_TOOLS.map((tool) => (
        <li key={tool.id} className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{tool.label}</span>: {tool.description}
          {!compact && (
            <>
              {' '}Dati usati: {tool.dataSent}. Li elabora {tool.provider}.
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
