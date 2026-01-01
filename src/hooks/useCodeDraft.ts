import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface UseCodeDraftOptions {
  lessonId?: string;
  taskId?: string;
  codeType: 'python' | 'html' | 'css' | 'js';
  defaultCode: string;
}

export function useCodeDraft({ lessonId, taskId, codeType, defaultCode }: UseCodeDraftOptions) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState(defaultCode);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load saved code on mount
  useEffect(() => {
    if (!user || (!lessonId && !taskId)) {
      setIsLoading(false);
      return;
    }

    loadDraft();
  }, [user, lessonId, taskId, codeType]);

  const loadDraft = async () => {
    if (!user) return;

    try {
      let query = supabase
        .from('student_code_drafts')
        .select('content, updated_at')
        .eq('student_id', user.id)
        .eq('code_type', codeType);

      if (lessonId) {
        query = query.eq('lesson_id', lessonId);
      } else if (taskId) {
        query = query.eq('task_id', taskId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Error loading code draft:', error);
      } else if (data) {
        setCode(data.content);
        setLastSaved(new Date(data.updated_at));
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDraft = useCallback(async (newCode: string) => {
    if (!user || (!lessonId && !taskId)) return;

    setIsSaving(true);

    try {
      const payload = {
        student_id: user.id,
        lesson_id: lessonId || null,
        task_id: taskId || null,
        code_type: codeType,
        content: newCode,
      };

      // Try to upsert
      const { error } = await supabase
        .from('student_code_drafts')
        .upsert(payload, {
          onConflict: lessonId ? 'student_id,lesson_id,code_type' : 'student_id,task_id,code_type'
        });

      if (error) {
        console.error('Error saving draft:', error);
        // Don't show error toast for every autosave failure
      } else {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [user, lessonId, taskId, codeType]);

  // Auto-save with debounce
  useEffect(() => {
    if (isLoading || code === defaultCode) return;

    const timeoutId = setTimeout(() => {
      saveDraft(code);
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [code, isLoading, saveDraft]);

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const resetCode = () => {
    setCode(defaultCode);
    toast({
      title: 'Codice resettato',
      description: 'Il codice è stato resettato al valore iniziale',
    });
  };

  const manualSave = async () => {
    await saveDraft(code);
    toast({
      title: 'Salvato',
      description: 'Il tuo codice è stato salvato',
    });
  };

  return {
    code,
    setCode: handleCodeChange,
    isLoading,
    isSaving,
    lastSaved,
    resetCode,
    saveDraft: manualSave,
    loadDraft,
  };
}