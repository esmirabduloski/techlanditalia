import { PythonCompiler } from './PythonCompiler';
import { TurtleCompiler } from './TurtleCompiler';
import { PgzeroCompiler } from './PgzeroCompiler';
import { WebCompiler } from './WebCompiler';
import type { WorkspaceSidePanel } from './LessonWorkspace';
import { parseTestCases, type TestResult } from '@/lib/testCases';
import { PYTHON_COURSES, WEB_COURSES, resolveCompiler } from '@/lib/compilerKind';

export { PYTHON_COURSES, WEB_COURSES };
export const SPLIT_LAYOUT_COURSES = [...PYTHON_COURSES, ...WEB_COURSES];

export interface TaskAttachment {
  name: string;
  url: string;
  type: 'image' | 'css' | 'js' | 'html';
}

export interface SidePanelTask {
  id: string;
  content_type: string | null;
  scratch_url: string | null;
  default_python_code: string | null;
  default_html_code: string | null;
  default_css_code: string | null;
  default_js_code: string | null;
  python_env: string | null;
  replit_url: string | null;
  attachments: TaskAttachment[];
  // Correzione automatica (jsonb lesson_tasks.test_cases)
  test_cases?: unknown;
}

function getScratchEmbedUrl(url: string): string {
  if (url.includes('/embed')) return url;
  const match = url.match(/scratch\.mit\.edu\/projects\/(\d+)/);
  return match ? `https://scratch.mit.edu/projects/${match[1]}/embed` : url;
}

function ScratchPanel({ url }: { url: string }) {
  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b bg-background">
        <h3 className="font-semibold flex items-center gap-2">🐱 Scratch - Gioca e Impara</h3>
        <p className="text-sm text-muted-foreground">Clicca sulla bandierina verde per iniziare il gioco!</p>
      </div>
      <div className="flex-1 p-4">
        <iframe
          src={getScratchEmbedUrl(url)}
          className="w-full h-full rounded-lg border shadow-sm"
          allowFullScreen
          title="Scratch Game"
        />
      </div>
    </div>
  );
}

/**
 * Pannello destro di un task: gioco Scratch, oppure compilatore per i task "misto"
 * dei corsi Python/Web. `saveDrafts` = salva il codice dello studente (non per l'insegnante).
 * `onTestResults` riceve l'esito di "Verifica" quando la task ha casi di prova.
 */
export function getTaskSidePanel(
  courseSlug: string,
  task: SidePanelTask,
  { saveDrafts, onTestResults }: { saveDrafts: boolean; onTestResults?: (results: TestResult[]) => void },
): WorkspaceSidePanel | undefined {
  if (task.content_type === 'scratch' && task.scratch_url) {
    return { label: 'Gioco', emoji: '🐱', node: <ScratchPanel url={task.scratch_url} />, defaultSize: 60 };
  }

  if (task.content_type !== 'mixed') return undefined;
  const taskId = saveDrafts ? task.id : undefined;
  const testCases = parseTestCases(task.test_cases);

  const kind = resolveCompiler(courseSlug, task);
  if (kind === 'python' || kind === 'turtle' || kind === 'pgzero') {
    const node = kind === 'turtle' ? (
      <TurtleCompiler defaultCode={task.default_python_code || undefined} taskId={taskId} />
    ) : kind === 'pgzero' ? (
      <PgzeroCompiler defaultCode={task.default_python_code || undefined} replitUrl={task.replit_url || undefined} taskId={taskId} attachments={task.attachments} />
    ) : (
      <PythonCompiler defaultCode={task.default_python_code || undefined} taskId={taskId} testCases={testCases} onTestResults={onTestResults} />
    );
    return { label: 'Codice', emoji: '💻', node };
  }

  if (kind === 'web') {
    return {
      label: 'Codice',
      emoji: '💻',
      node: (
        <WebCompiler
          defaultHtmlCode={task.default_html_code || undefined}
          defaultCssCode={task.default_css_code || undefined}
          defaultJsCode={task.default_js_code || undefined}
          taskId={taskId}
          taskAttachments={task.attachments}
          testCases={testCases}
          onTestResults={onTestResults}
        />
      ),
    };
  }

  return undefined;
}

/** Casi di prova che la task fa davvero eseguire (Turtle e Pygame Zero non li supportano). */
export function getRunnableTaskTests(courseSlug: string, task: SidePanelTask) {
  if (task.content_type !== 'mixed') return [];
  const cases = parseTestCases(task.test_cases);
  const kind = resolveCompiler(courseSlug, task);
  if (kind === 'python') return cases.filter(c => c.kind === 'io' || c.kind === 'assert');
  if (kind === 'web') return cases.filter(c => c.kind !== 'io' && c.kind !== 'assert');
  return [];
}

/** Compilatore libero per le lezioni senza task dei corsi Python/Web. */
export function getLessonSidePanel(courseSlug: string): WorkspaceSidePanel | undefined {
  if (PYTHON_COURSES.includes(courseSlug)) return { label: 'Codice', emoji: '💻', node: <PythonCompiler /> };
  if (WEB_COURSES.includes(courseSlug)) return { label: 'Codice', emoji: '💻', node: <WebCompiler /> };
  return undefined;
}
