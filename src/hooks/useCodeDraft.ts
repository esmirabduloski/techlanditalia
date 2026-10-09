import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { draftColumns, draftConflictTarget, draftTarget, registerDraftFlusher } from '@/lib/codeDrafts';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface UseCodeDraftOptions {
  /** Id del task, oppure "homework-<id>" per i compiti (vedi lib/codeDrafts). */
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
  // Per salvare all'uscita: codice attuale, ultimo contenuto salvato e stato di caricamento
  const codeRef = useRef(code);
  codeRef.current = code;
  const savedCodeRef = useRef<string | null>(null);
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

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
      savedCodeRef.current = null;
    }

    if (!user || !taskId) {
      setIsLoading(false);
      return;
    }

    loadDraft();
  }, [user, taskId, codeType, defaultCode]);

  const loadDraft = async () => {
    if (!user || !taskId) return;
    const target = draftTarget(taskId);

    try {
      const { data, error } = await supabase
        .from('student_code_drafts')
        .select('content, updated_at')
        .eq('student_id', user.id)
        .eq(target.column, target.id)
        .eq('code_type', codeType)
        .maybeSingle();

      if (error) {
        console.error('Error loading code draft:', error);
      } else if (data) {
        setCode(data.content);
        savedCodeRef.current = data.content;
        setLastSaved(new Date(data.updated_at));
        setHasDraft(true);
      } else {
        // Nessun draft salvato, usa il codice di default
        setCode(defaultCode);
        savedCodeRef.current = defaultCode;
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
    const target = draftTarget(taskId);

    setIsSaving(true);

    try {
      const payload = {
        student_id: user.id,
        ...draftColumns(target),
        code_type: codeType,
        content: newCode,
      };

      const { error } = await supabase
        .from('student_code_drafts')
        .upsert(payload, {
          onConflict: draftConflictTarget(target),
        });

      if (error) {
        console.error('Error saving draft:', error);
      } else {
        savedCodeRef.current = newCode;
        setLastSaved(new Date());
        setHasDraft(true);
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [user, taskId, codeType]);

  // Auto-save with debounce (3000ms per salvataggio più affidabile).
  // Confronto con l'ultimo contenuto salvato: così anche "Ripristina" (ritorno al
  // codice iniziale dopo aver salvato) viene salvato.
  useEffect(() => {
    if (isLoading || !taskId || code === savedCodeRef.current) return;

    const timeoutId = setTimeout(() => {
      saveDraft(code);
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [code, isLoading, saveDraft, taskId, defaultCode]);

  // Salvataggio immediato quando lo studente lascia l'esercizio (task successivo,
  // altra pagina) o nasconde la scheda: senza, il timer qui sopra veniva annullato
  // e le modifiche degli ultimi 3 secondi andavano perse.
  useEffect(() => {
    if (!user || !taskId) return;
    const target = draftTarget(taskId);
    const flush = async () => {
      const current = codeRef.current;
      // Niente da salvare se coincide con l'ultimo contenuto salvato (o, senza bozza, col codice iniziale)
      if (isLoadingRef.current || current === savedCodeRef.current) return;
      savedCodeRef.current = current;
      const { error } = await supabase
        .from('student_code_drafts')
        .upsert(
          { student_id: user.id, ...draftColumns(target), code_type: codeType, content: current },
          { onConflict: draftConflictTarget(target) },
        );
      if (error) {
        savedCodeRef.current = null;
        console.error('Error saving draft on exit:', error);
      }
    };
    const unregister = registerDraftFlusher(flush);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush();
    };
    const onPageHide = () => void flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      unregister();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      void flush();
    };
  }, [user, taskId, codeType, defaultCode]);

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
