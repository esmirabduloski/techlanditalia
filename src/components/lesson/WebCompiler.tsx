import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Upload, Trash2, Copy, FolderOpen, X, Loader2, Save, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCodeDraft } from '@/hooks/useCodeDraft';

interface UploadedFile {
  name: string;
  url: string;
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Ciao, Mondo!</h1>
  <p>Modifica questo codice per vedere i cambiamenti.</p>
</body>
</html>`;

const DEFAULT_CSS = `body {
  font-family: Arial, sans-serif;
  padding: 20px;
  background-color: #f0f0f0;
}

h1 {
  color: #333;
}

p {
  color: #666;
}`;

const DEFAULT_JS = '// JavaScript opzionale\nconsole.log("Hello from JavaScript!");';

export function WebCompiler() {
  const { courseId, lessonNumber, taskNumber } = useParams();
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('html');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showFileManager, setShowFileManager] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch lesson/task IDs
  useEffect(() => {
    const fetchIds = async () => {
      if (!courseId || !lessonNumber) return;

      const { data: lessonData } = await supabase
        .from('lessons')
        .select('id')
        .eq('course_id', courseId)
        .eq('lesson_number', parseInt(lessonNumber))
        .maybeSingle();

      if (lessonData) {
        if (taskNumber) {
          const { data: taskData } = await supabase
            .from('lesson_tasks')
            .select('id')
            .eq('lesson_id', lessonData.id)
            .eq('task_number', parseInt(taskNumber))
            .maybeSingle();
          
          if (taskData) {
            setTaskId(taskData.id);
          }
        } else {
          setLessonId(lessonData.id);
        }
      }
    };

    fetchIds();
  }, [courseId, lessonNumber, taskNumber]);

  // Use code drafts for each file type
  const htmlDraft = useCodeDraft({
    lessonId: lessonId || undefined,
    taskId: taskId || undefined,
    codeType: 'html',
    defaultCode: DEFAULT_HTML,
  });

  const cssDraft = useCodeDraft({
    lessonId: lessonId || undefined,
    taskId: taskId || undefined,
    codeType: 'css',
    defaultCode: DEFAULT_CSS,
  });

  const jsDraft = useCodeDraft({
    lessonId: lessonId || undefined,
    taskId: taskId || undefined,
    codeType: 'js',
    defaultCode: DEFAULT_JS,
  });

  useEffect(() => {
    updatePreview();
  }, [htmlDraft.code, cssDraft.code, jsDraft.code]);

  const updatePreview = () => {
    if (!iframeRef.current) return;

    const combinedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>${cssDraft.code}</style>
      </head>
      <body>
        ${htmlDraft.code.replace(/<!DOCTYPE html>|<\/?html>|<\/?head>|<\/?body>|<link[^>]*>/gi, '')}
        <script>${jsDraft.code}</script>
      </body>
      </html>
    `;

    const blob = new Blob([combinedHtml], { type: 'text/html' });
    iframeRef.current.src = URL.createObjectURL(blob);
  };

  // Allowed image types for web compiler
  const ALLOWED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
  const ALLOWED_IMAGE_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'
  ];

  const getFileExtension = (fileName: string): string => {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };

  const readFileBytes = async (file: File, numBytes: number = 8): Promise<number[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer;
        const bytes = new Uint8Array(arrayBuffer);
        resolve(Array.from(bytes.slice(0, numBytes)));
      };
      reader.onerror = () => resolve([]);
      reader.readAsArrayBuffer(file.slice(0, numBytes));
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        const extension = getFileExtension(file.name);
        if (!ALLOWED_IMAGE_EXTENSIONS.includes(extension)) {
          toast({
            variant: 'destructive',
            title: 'Tipo di file non consentito',
            description: `Solo immagini sono consentite. .${extension} non è supportato`,
          });
          continue;
        }

        if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
          toast({
            variant: 'destructive',
            title: 'Tipo di file non consentito',
            description: 'Solo immagini sono consentite',
          });
          continue;
        }

        if (file.size > 10 * 1024 * 1024) {
          toast({
            variant: 'destructive',
            title: 'File troppo grande',
            description: `${file.name} supera il limite di 10MB`,
          });
          continue;
        }

        const fileBytes = await readFileBytes(file);

        const { data: validationResult, error: validationError } = await supabase.functions.invoke(
          'validate-file-upload',
          {
            body: {
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type,
              fileBytes,
              bucket: 'web-compiler-assets'
            }
          }
        );

        if (validationError || !validationResult.valid) {
          console.error('Validation error:', validationError || validationResult.error);
          toast({
            variant: 'destructive',
            title: 'File non valido',
            description: validationResult?.error || 'Impossibile validare il file',
          });
          continue;
        }

        const fileName = `${user.id}/${Date.now()}-${file.name}`;

        const { data, error } = await supabase.storage
          .from('web-compiler-assets')
          .upload(fileName, file);

        if (error) {
          console.error('Upload error:', error);
          toast({
            variant: 'destructive',
            title: 'Errore upload',
            description: `Impossibile caricare ${file.name}`,
          });
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('web-compiler-assets')
          .getPublicUrl(fileName);

        setUploadedFiles(prev => [...prev, {
          name: file.name,
          url: urlData.publicUrl,
        }]);

        toast({
          title: 'File caricato',
          description: `${file.name} caricato con successo`,
        });
      }
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'URL copiato',
      description: 'Incollalo nel tuo codice HTML',
    });
  };

  const removeFile = async (file: UploadedFile) => {
    try {
      const path = file.url.split('/web-compiler-assets/')[1];
      if (path) {
        await supabase.storage.from('web-compiler-assets').remove([decodeURIComponent(path)]);
      }
      setUploadedFiles(prev => prev.filter(f => f.url !== file.url));
      toast({
        title: 'File rimosso',
      });
    } catch (error) {
      console.error('Error removing file:', error);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files.length > 0 && fileInputRef.current) {
      const dt = new DataTransfer();
      for (const file of Array.from(files)) {
        dt.items.add(file);
      }
      fileInputRef.current.files = dt.files;
      handleFileUpload({ target: { files: dt.files } } as any);
    }
  };

  const saveAllDrafts = async () => {
    await Promise.all([
      htmlDraft.saveDraft(),
      cssDraft.saveDraft(),
      jsDraft.saveDraft(),
    ]);
  };

  const resetAllCode = () => {
    htmlDraft.resetCode();
    cssDraft.resetCode();
    jsDraft.resetCode();
  };

  const isSaving = htmlDraft.isSaving || cssDraft.isSaving || jsDraft.isSaving;
  const isLoading = htmlDraft.isLoading || cssDraft.isLoading || jsDraft.isLoading;

  const formatLastSaved = () => {
    const dates = [htmlDraft.lastSaved, cssDraft.lastSaved, jsDraft.lastSaved].filter(Boolean) as Date[];
    if (dates.length === 0) return null;
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    return latest.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">🌐 Web Editor</span>
          {isSaving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Salvataggio...
            </span>
          )}
          {!isSaving && formatLastSaved() && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="w-3 h-3 text-green-500" />
              Salvato {formatLastSaved()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={saveAllDrafts}
            disabled={isSaving}
            title="Salva tutto"
          >
            <Save className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFileManager(!showFileManager)}
            title="Gestione file"
          >
            <FolderOpen className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={updatePreview}
          >
            <Play className="w-4 h-4 mr-1" />
            Aggiorna
          </Button>
        </div>
      </div>

      {/* File Manager Sidebar */}
      {showFileManager && (
        <div className="border-b border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">📁 File Manager</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFileManager(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Upload Zone */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-4 text-center mb-4 hover:border-primary/50 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              {isUploading ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Caricamento...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="w-6 h-6" />
                  <span className="text-sm">Carica immagini o trascina qui</span>
                </div>
              )}
            </label>
          </div>

          {/* Uploaded Files List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {uploadedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-background rounded border border-border"
                >
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyUrl(file.url)}
                    title="Copia URL"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file)}
                    className="text-destructive"
                    title="Rimuovi"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Code Editor Tabs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-muted/30">
              <TabsTrigger value="html" className="data-[state=active]:bg-background">
                HTML
              </TabsTrigger>
              <TabsTrigger value="css" className="data-[state=active]:bg-background">
                CSS
              </TabsTrigger>
              <TabsTrigger value="js" className="data-[state=active]:bg-background">
                JavaScript
              </TabsTrigger>
            </TabsList>

            <TabsContent value="html" className="flex-1 m-0 overflow-hidden">
              <textarea
                value={htmlDraft.code}
                onChange={(e) => htmlDraft.setCode(e.target.value)}
                className="w-full h-full p-4 font-mono text-sm bg-background text-foreground resize-none focus:outline-none"
                spellCheck={false}
              />
            </TabsContent>
            <TabsContent value="css" className="flex-1 m-0 overflow-hidden">
              <textarea
                value={cssDraft.code}
                onChange={(e) => cssDraft.setCode(e.target.value)}
                className="w-full h-full p-4 font-mono text-sm bg-background text-foreground resize-none focus:outline-none"
                spellCheck={false}
              />
            </TabsContent>
            <TabsContent value="js" className="flex-1 m-0 overflow-hidden">
              <textarea
                value={jsDraft.code}
                onChange={(e) => jsDraft.setCode(e.target.value)}
                className="w-full h-full p-4 font-mono text-sm bg-background text-foreground resize-none focus:outline-none"
                spellCheck={false}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Preview */}
        <div className="h-1/3 min-h-[150px] border-t border-border">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground">Preview</span>
          </div>
          <iframe
            ref={iframeRef}
            title="Preview"
            className="w-full h-[calc(100%-32px)] bg-white"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}