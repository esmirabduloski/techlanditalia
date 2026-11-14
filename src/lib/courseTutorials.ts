import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Reuse the authenticated client; do not change generated types for a pending migration.
// 0088_course_homework_tutorials: tutorial "come consegnare i compiti" per corso.

// type, non interface: supabase-js vuole righe assegnabili a Record<string, unknown>
export type CourseTutorial = {
  course_id: string;
  video_url: string | null;
  video_path: string | null;
  pdf_path: string | null;
};

type TutorialsDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
      course_homework_tutorials: {
        Row: CourseTutorial & { created_at: string; updated_at: string };
        Insert: CourseTutorial;
        Update: Partial<CourseTutorial>;
        Relationships: [];
      };
    };
  };
};

const client = supabase as unknown as SupabaseClient<TutorialsDatabase>;

export const TUTORIAL_BUCKET = 'course-tutorials';
/** Limite del bucket (0088): 50 MB a file. */
export const TUTORIAL_MAX_BYTES = 50 * 1024 * 1024;
export const TUTORIAL_VIDEO_TYPES = ['video/mp4', 'video/webm'];
export const NOT_AVAILABLE_MESSAGE = "Funzione non ancora attiva: manca l'aggiornamento del database.";

/** Tabella non ancora creata: la migrazione 0088 non è applicata. */
export function isMissingTutorialsSchema(error: { code?: string } | null | undefined): boolean {
  return ['42P01', 'PGRST205'].includes(error?.code ?? '');
}

/** C'è qualcosa da mostrare allo studente? */
export function hasTutorialContent(t: CourseTutorial | null | undefined): t is CourseTutorial {
  return !!t && !!(t.video_url || t.video_path || t.pdf_path);
}

/**
 * Link YouTube o Vimeo → indirizzo da incorporare; null se il link non è di questi siti.
 * YouTube in modalità privacy (youtube-nocookie), come nelle lezioni.
 */
export function videoEmbedUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.replace(/^(www\.|m\.)/, '');
  const id = /^[A-Za-z0-9_-]{6,20}$/;

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = parsed.searchParams.get('v');
    const [, kind, path] = parsed.pathname.split('/');
    const candidate = v ?? (['embed', 'shorts', 'live'].includes(kind) ? path : null);
    return candidate && id.test(candidate) ? `https://www.youtube-nocookie.com/embed/${candidate}` : null;
  }
  if (host === 'youtu.be') {
    const candidate = parsed.pathname.slice(1);
    return id.test(candidate) ? `https://www.youtube-nocookie.com/embed/${candidate}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const match = parsed.pathname.match(/(?:^|\/)(\d{6,12})(?:\/|$)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : null;
  }
  return null;
}

/** Controllo del link video nel modulo admin: null se va bene (o è vuoto), altrimenti il messaggio. */
export function validateVideoLink(url: string): string | null {
  if (!url.trim()) return null;
  return videoEmbedUrl(url) ? null : 'Incolla un link di YouTube o Vimeo (es. https://www.youtube.com/watch?v=...).';
}

/** Controllo dei file caricati dall'admin: null se va bene, altrimenti il messaggio. */
export function validateTutorialFile(file: { name: string; type: string; size: number }, kind: 'video' | 'pdf'): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const ok = kind === 'pdf'
    ? ext === 'pdf' && (file.type === 'application/pdf' || file.type === '')
    : ['mp4', 'webm'].includes(ext) && (TUTORIAL_VIDEO_TYPES.includes(file.type) || file.type === '');
  if (!ok) return kind === 'pdf' ? 'Carica un file PDF.' : 'Carica un video .mp4 o .webm.';
  if (file.size <= 0) return 'Il file è vuoto.';
  if (file.size > TUTORIAL_MAX_BYTES) return 'Il file non può superare i 50 MB. Per i video più lunghi usa un link YouTube.';
  return null;
}

/** Percorso nel bucket: "<id corso>/<tipo>-<data>.<estensione>". */
export function tutorialFilePath(courseId: string, kind: 'video' | 'pdf', fileName: string, now = Date.now()): string {
  const ext = kind === 'pdf' ? 'pdf' : (fileName.toLowerCase().split('.').pop() === 'webm' ? 'webm' : 'mp4');
  return `${courseId}/${kind === 'pdf' ? 'guida' : 'video'}-${now}.${ext}`;
}

/** Tutorial dei corsi indicati (RLS: solo i corsi a cui si è iscritti, tutti per l'admin). */
export async function fetchCourseTutorials(courseIds: string[]): Promise<CourseTutorial[]> {
  if (courseIds.length === 0) return [];
  const { data, error } = await client
    .from('course_homework_tutorials')
    .select('course_id, video_url, video_path, pdf_path')
    .in('course_id', courseIds);
  if (error) {
    if (!isMissingTutorialsSchema(error)) console.warn('Tutorial compiti non disponibili:', error.message);
    return [];
  }
  return data ?? [];
}

export async function fetchCourseTutorial(courseId: string): Promise<CourseTutorial | null> {
  const [tutorial] = await fetchCourseTutorials([courseId]);
  return tutorial ?? null;
}

/** Carica un file dell'admin nel bucket e restituisce il percorso (o un errore). */
export async function uploadTutorialFile(
  courseId: string,
  kind: 'video' | 'pdf',
  file: File,
): Promise<{ path: string } | { error: string }> {
  const invalid = validateTutorialFile(file, kind);
  if (invalid) return { error: invalid };
  const path = tutorialFilePath(courseId, kind, file.name);
  const contentType = kind === 'pdf' ? 'application/pdf' : (path.endsWith('.webm') ? 'video/webm' : 'video/mp4');
  const { error } = await supabase.storage.from(TUTORIAL_BUCKET).upload(path, file, { contentType, upsert: false });
  if (error) {
    return { error: /bucket not found/i.test(error.message) ? NOT_AVAILABLE_MESSAGE : error.message };
  }
  return { path };
}

/** Toglie dal bucket i file non più usati (errori ignorati: il file orfano non dà fastidio). */
export async function removeTutorialFiles(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p);
  if (list.length === 0) return;
  const { error } = await supabase.storage.from(TUTORIAL_BUCKET).remove(list);
  if (error) console.warn('File del tutorial non rimossi:', error.message);
}

/**
 * Salva il tutorial del corso; senza video né PDF lo toglie.
 * Restituisce un messaggio d'errore o null.
 */
export async function saveCourseTutorial(tutorial: CourseTutorial): Promise<string | null> {
  const video_url = tutorial.video_url?.trim() || null;
  const invalid = video_url ? validateVideoLink(video_url) : null;
  if (invalid) return invalid;
  if (video_url && tutorial.video_path) return 'Scegli un solo video: il link oppure il file.';

  const row: CourseTutorial = { ...tutorial, video_url };
  const { error } = hasTutorialContent(row)
    ? await client.from('course_homework_tutorials').upsert(row, { onConflict: 'course_id' })
    : await client.from('course_homework_tutorials').delete().eq('course_id', tutorial.course_id);
  if (error) return isMissingTutorialsSchema(error) ? NOT_AVAILABLE_MESSAGE : error.message;
  return null;
}
