import { PythonCompiler } from './PythonCompiler';
import { TurtleCompiler } from './TurtleCompiler';
import { PgzeroCompiler } from './PgzeroCompiler';
import { WebCompiler } from './WebCompiler';
import type { WorkspaceSidePanel } from './LessonWorkspace';

export const PYTHON_COURSES = ['python-base', 'python-ai', 'python-avanzato'];
export const WEB_COURSES = ['web-development'];
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
 */
export function getTaskSidePanel(
  courseSlug: string,
  task: SidePanelTask,
  { saveDrafts }: { saveDrafts: boolean },
): WorkspaceSidePanel | undefined {
  if (task.content_type === 'scratch' && task.scratch_url) {
    return { label: 'Gioco', emoji: '🐱', node: <ScratchPanel url={task.scratch_url} />, defaultSize: 60 };
  }

  if (task.content_type !== 'mixed') return undefined;
  const taskId = saveDrafts ? task.id : undefined;

  if (PYTHON_COURSES.includes(courseSlug)) {
    const node = task.python_env === 'turtle' ? (
      <TurtleCompiler defaultCode={task.default_python_code || undefined} />
    ) : task.python_env === 'pgzero' ? (
      <PgzeroCompiler defaultCode={task.default_python_code || undefined} replitUrl={task.replit_url || undefined} />
    ) : (
      <PythonCompiler defaultCode={task.default_python_code || undefined} taskId={taskId} />
    );
    return { label: 'Codice', emoji: '💻', node };
  }

  if (WEB_COURSES.includes(courseSlug)) {
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
        />
      ),
    };
  }

  return undefined;
}

/** Compilatore libero per le lezioni senza task dei corsi Python/Web. */
export function getLessonSidePanel(courseSlug: string): WorkspaceSidePanel | undefined {
  if (PYTHON_COURSES.includes(courseSlug)) return { label: 'Codice', emoji: '💻', node: <PythonCompiler /> };
  if (WEB_COURSES.includes(courseSlug)) return { label: 'Codice', emoji: '💻', node: <WebCompiler /> };
  return undefined;
}
