import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface UseCodeDraftOptions {
  taskId?: string;
  codeType: 'python' | 'html' | 'css' | 'js';
  defaultCode: string;
}

export function useCodeDraft({ taskId, codeType, defaultCode }: UseCodeDraftOptions) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [code, setCode] = useState(defaultCode);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const lastTaskIdRef = useRef<string | undefined>(undefined);
  const lastDefaultCodeRef = useRef<string>(defaultCode);

  // Reset and load when taskId changes
  useEffect(() => {
    // Se il taskId è cambiato, resetta lo stato
    if (taskId !== lastTaskIdRef.current || defaultCode !== lastDefaultCodeRef.current) {
      lastTaskIdRef.current = taskId;
      lastDefaultCodeRef.current = defaultCode;
      setCode(defaultCode);
      setHasDraft(false);
      setLastSaved(null);
      setIsLoading(true);
    }

    if (!user || !taskId) {
      setIsLoading(false);
      return;
    }

    loadDraft();
  }, [user, taskId, codeType, defaultCode]);

  const loadDraft = async () => {
    if (!user || !taskId) return;

    try {
      const { data, error } = await supabase
        .from('student_code_drafts')
        .select('content, updated_at')
        .eq('student_id', user.id)
        .eq('task_id', taskId)
        .eq('code_type', codeType)
        .maybeSingle();

      if (error) {
        console.error('Error loading code draft:', error);
      } else if (data) {
        setCode(data.content);
        setLastSaved(new Date(data.updated_at));
        setHasDraft(true);
      } else {
        // Nessun draft salvato, usa il codice di default
        setCode(defaultCode);
        setHasDraft(false);
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDraft = useCallback(async (newCode: string) => {
    if (!user || !taskId) return;

    setIsSaving(true);

    try {
      const payload = {
        student_id: user.id,
        task_id: taskId,
        code_type: codeType,
        content: newCode,
      };

      const { error } = await supabase
        .from('student_code_drafts')
        .upsert(payload, {
          onConflict: 'student_id,task_id,code_type'
        });

      if (error) {
        console.error('Error saving draft:', error);
      } else {
        setLastSaved(new Date());
        setHasDraft(true);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [user, taskId, codeType]);

  // Auto-save with debounce
  useEffect(() => {
    if (isLoading || !taskId || code === defaultCode) return;

    const timeoutId = setTimeout(() => {
      saveDraft(code);
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [code, isLoading, saveDraft, taskId, defaultCode]);

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
    hasDraft,
  };
}