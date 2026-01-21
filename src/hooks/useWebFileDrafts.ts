import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface UploadedFile {
  name: string;
  url: string;
  type: 'image' | 'css' | 'js' | 'html';
}

interface JsFile {
  id: string;
  name: string;
  code: string;
}

interface WebFilesData {
  uploadedFiles: UploadedFile[];
  additionalJsFiles: JsFile[];
}

interface UseWebFileDraftsOptions {
  taskId?: string;
}

export function useWebFileDrafts({ taskId }: UseWebFileDraftsOptions) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [additionalJsFiles, setAdditionalJsFiles] = useState<JsFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const lastTaskIdRef = useRef<string | undefined>(undefined);

  // Reset and load when taskId changes
  useEffect(() => {
    if (taskId !== lastTaskIdRef.current) {
      lastTaskIdRef.current = taskId;
      setUploadedFiles([]);
      setAdditionalJsFiles([]);
      setLastSaved(null);
      setIsLoading(true);
    }

    if (!user || !taskId) {
      setIsLoading(false);
      return;
    }

    loadDraft();
  }, [user, taskId]);

  const loadDraft = async () => {
    if (!user || !taskId) return;

    try {
      const { data, error } = await supabase
        .from('student_code_drafts')
        .select('content, updated_at')
        .eq('student_id', user.id)
        .eq('task_id', taskId)
        .eq('code_type', 'web_files')
        .maybeSingle();

      if (error) {
        console.error('Error loading web files draft:', error);
      } else if (data) {
        try {
          const parsed: WebFilesData = JSON.parse(data.content);
          setUploadedFiles(parsed.uploadedFiles || []);
          setAdditionalJsFiles(parsed.additionalJsFiles || []);
          setLastSaved(new Date(data.updated_at));
        } catch (parseError) {
          console.error('Error parsing web files draft:', parseError);
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDraft = useCallback(async (
    filesToSave?: UploadedFile[],
    jsFilesToSave?: JsFile[]
  ) => {
    if (!user || !taskId) return;

    const currentUploadedFiles = filesToSave ?? uploadedFiles;
    const currentJsFiles = jsFilesToSave ?? additionalJsFiles;

    // Don't save if there's nothing to save
    if (currentUploadedFiles.length === 0 && currentJsFiles.length === 0) {
      return;
    }

    setIsSaving(true);

    try {
      const webFilesData: WebFilesData = {
        uploadedFiles: currentUploadedFiles,
        additionalJsFiles: currentJsFiles,
      };

      const payload = {
        student_id: user.id,
        task_id: taskId,
        code_type: 'web_files',
        content: JSON.stringify(webFilesData),
      };

      const { error } = await supabase
        .from('student_code_drafts')
        .upsert(payload, {
          onConflict: 'student_id,task_id,code_type'
        });

      if (error) {
        console.error('Error saving web files draft:', error);
      } else {
        setLastSaved(new Date());
      }
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [user, taskId, uploadedFiles, additionalJsFiles]);

  const manualSave = async () => {
    await saveDraft();
    toast({
      title: 'Salvato',
      description: 'I file aggiuntivi sono stati salvati',
    });
  };

  const addUploadedFile = (file: UploadedFile) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev, file];
      // Auto-save when adding files
      saveDraft(newFiles, additionalJsFiles);
      return newFiles;
    });
  };

  const removeUploadedFile = async (fileUrl: string) => {
    const newFiles = uploadedFiles.filter(f => f.url !== fileUrl);
    setUploadedFiles(newFiles);
    // Immediately save to persist the deletion
    await saveDraft(newFiles, additionalJsFiles);
  };

  const addJsFile = (file: JsFile) => {
    setAdditionalJsFiles(prev => [...prev, file]);
  };

  const updateJsFile = (id: string, code: string) => {
    setAdditionalJsFiles(prev => prev.map(f => f.id === id ? { ...f, code } : f));
  };

  const removeJsFile = (id: string) => {
    setAdditionalJsFiles(prev => prev.filter(f => f.id !== id));
  };

  const resetFiles = () => {
    setUploadedFiles([]);
    setAdditionalJsFiles([]);
  };

  return {
    uploadedFiles,
    setUploadedFiles,
    additionalJsFiles,
    setAdditionalJsFiles,
    isLoading,
    isSaving,
    lastSaved,
    saveDraft,
    manualSave,
    loadDraft,
    addUploadedFile,
    removeUploadedFile,
    addJsFile,
    updateJsFile,
    removeJsFile,
    resetFiles,
  };
}
