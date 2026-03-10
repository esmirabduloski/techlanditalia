import { useState, useEffect, useCallback, useRef } from 'react';

interface Attachment {
  name: string;
  url: string;
  type: 'image' | 'css' | 'js' | 'html' | 'audio' | 'video';
}

interface TaskData {
  title: string;
  description: string;
  content: string;
  content_type: string;
  slides_url: string;
  scratch_url: string;
  points_reward: number;
  task_number: number;
  default_python_code: string;
  default_html_code: string;
  default_css_code: string;
  default_js_code: string;
  python_env: string;
  replit_url: string;
  attachments: Attachment[];
}

interface UseTaskEditorDraftOptions {
  courseId?: string;
  lessonId?: string;
  taskId?: string; // undefined for new tasks
  isEditing: boolean;
}

const DRAFT_KEY_PREFIX = 'task_editor_draft_';
const DEBOUNCE_MS = 1000;

export function useTaskEditorDraft({ courseId, lessonId, taskId, isEditing }: UseTaskEditorDraftOptions) {
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Generate a unique key for this draft
  const getDraftKey = useCallback(() => {
    if (isEditing && taskId) {
      return `${DRAFT_KEY_PREFIX}edit_${taskId}`;
    }
    return `${DRAFT_KEY_PREFIX}new_${courseId}_${lessonId}`;
  }, [courseId, lessonId, taskId, isEditing]);

  // Load draft from localStorage
  const loadDraft = useCallback((): TaskData | null => {
    if (!courseId || !lessonId) return null;
    
    try {
      const key = getDraftKey();
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if draft is not too old (24 hours)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setHasDraft(true);
          return parsed.data as TaskData;
        } else {
          // Draft is too old, remove it
          localStorage.removeItem(key);
        }
      }
    } catch (e) {
      console.error('Error loading task draft:', e);
    }
    return null;
  }, [courseId, lessonId, getDraftKey]);

  // Save draft to localStorage with debounce
  const saveDraft = useCallback((data: TaskData) => {
    if (!courseId || !lessonId) return;
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce the save
    saveTimeoutRef.current = setTimeout(() => {
      try {
        const key = getDraftKey();
        const payload = {
          data,
          timestamp: Date.now(),
          courseId,
          lessonId,
          taskId,
        };
        localStorage.setItem(key, JSON.stringify(payload));
        setHasDraft(true);
        setLastSaved(new Date());
      } catch (e) {
        console.error('Error saving task draft:', e);
      }
    }, DEBOUNCE_MS);
  }, [courseId, lessonId, taskId, getDraftKey]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    if (!courseId || !lessonId) return;
    
    try {
      const key = getDraftKey();
      localStorage.removeItem(key);
      setHasDraft(false);
      setLastSaved(null);
    } catch (e) {
      console.error('Error clearing task draft:', e);
    }
  }, [courseId, lessonId, getDraftKey]);

  // Check if draft exists on mount
  useEffect(() => {
    if (courseId && lessonId && !initialLoadDoneRef.current) {
      const draft = loadDraft();
      setHasDraft(!!draft);
      initialLoadDoneRef.current = true;
    }
  }, [courseId, lessonId, loadDraft]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    hasDraft,
    lastSaved,
  };
}
