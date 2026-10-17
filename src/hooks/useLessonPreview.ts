import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from './useAuth';
import { useTeacherCourseAccess } from './useTeacherCourseAccess';

/**
 * Chi apre le viste "anteprima" di lezioni, task e compiti:
 * - teacher: /insegnante/corso/:courseSlug/...
 * - admin:   /admin/corsi/:courseId/anteprima/... (scheda "Visualizza")
 */
export type PreviewScope = 'teacher' | 'admin';

/** teacher = tutto il materiale (task nascosti, soluzioni dei quiz); student = come lo vedono gli alunni */
export type PreviewAudience = 'teacher' | 'student';

/** Accesso al corso e percorsi delle viste anteprima. */
export function usePreviewAccess(scope: PreviewScope) {
  const { courseSlug, courseId: courseIdParam } = useParams<{ courseSlug?: string; courseId?: string }>();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const teacher = useTeacherCourseAccess(scope === 'teacher' ? courseSlug : undefined);

  if (scope === 'admin') {
    return {
      hasAccess: isAdmin,
      isLoading: authLoading,
      courseId: courseIdParam ?? null,
      /** Base delle rotte lezione/task/compito */
      basePath: `/admin/corsi/${courseIdParam}/anteprima`,
      /** "Torna al corso" */
      courseHref: `/admin/corsi/${courseIdParam}/lezioni`,
      deniedHref: '/admin/login',
    };
  }

  const basePath = `/insegnante/corso/${courseSlug}`;
  return {
    hasAccess: teacher.hasAccess,
    isLoading: teacher.isLoading,
    courseId: teacher.courseId,
    basePath,
    courseHref: basePath,
    deniedHref: '/insegnante',
  };
}

const AUDIENCE_KEY = 'techland:lesson-preview-audience';

function readAudience(): PreviewAudience {
  try {
    return localStorage.getItem(AUDIENCE_KEY) === 'student' ? 'student' : 'teacher';
  } catch {
    return 'teacher';
  }
}

/**
 * Vista scelta dall'insegnante (ricordata passando da una lezione all'altra).
 * L'admin in "Visualizza" vede sempre la lezione come gli studenti.
 */
export function usePreviewAudience(scope: PreviewScope): [PreviewAudience, (audience: PreviewAudience) => void] {
  const [audience, setAudienceState] = useState<PreviewAudience>(() => (scope === 'admin' ? 'student' : readAudience()));

  const setAudience = useCallback((next: PreviewAudience) => {
    setAudienceState(next);
    try {
      localStorage.setItem(AUDIENCE_KEY, next);
    } catch {
      // Storage non disponibile (navigazione privata): la scelta vale solo per questa pagina
    }
  }, []);

  return [scope === 'admin' ? 'student' : audience, setAudience];
}
