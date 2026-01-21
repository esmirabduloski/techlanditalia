import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Trash2, Copy, FolderOpen, X, Loader2, Save, Check, Maximize2, Minimize2, ExternalLink, Plus, FileCode, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCodeDraft } from '@/hooks/useCodeDraft';
import { useWebFileDrafts } from '@/hooks/useWebFileDrafts';
import { CodeEditor } from './CodeEditor';

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

interface TaskAttachment {
  name: string;
  url: string;
  type: 'image' | 'css' | 'js' | 'html';
}


interface WebCompilerProps {
  defaultHtmlCode?: string;
  defaultCssCode?: string;
  defaultJsCode?: string;
  taskId?: string;
  taskAttachments?: TaskAttachment[];
}

const FALLBACK_HTML = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Ciao, Mondo!</h1>
  <p>Modifica questo codice per vedere i cambiamenti.</p>
</body>
</html>`;

const FALLBACK_CSS = `body {
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

const FALLBACK_JS = '// JavaScript opzionale\nconsole.log("Hello from JavaScript!");';

// File types configuration
const ALLOWED_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  css: ['css'],
  js: ['js'],
  html: ['html', 'htm']
};

const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  css: ['text/css'],
  js: ['text/javascript', 'application/javascript'],
  html: ['text/html']
};

const getFileType = (extension: string): 'image' | 'css' | 'js' | 'html' | null => {
  for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (extensions.includes(extension.toLowerCase())) {
      return type as 'image' | 'css' | 'js' | 'html';
    }
  }
  return null;
};

const getFileIcon = (type: 'image' | 'css' | 'js' | 'html') => {
  switch (type) {
    case 'image':
      return <ImageIcon className="w-4 h-4 text-green-500" />;
    case 'css':
      return <FileCode className="w-4 h-4 text-blue-500" />;
    case 'js':
      return <FileCode className="w-4 h-4 text-yellow-500" />;
    case 'html':
      return <FileText className="w-4 h-4 text-orange-500" />;
  }
};

export function WebCompiler({ defaultHtmlCode, defaultCssCode, defaultJsCode, taskId, taskAttachments = [] }: WebCompilerProps) {
  const [activeTab, setActiveTab] = useState<string>('html');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showFileManager, setShowFileManager] = useState<boolean>(false);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState<boolean>(false);
  const [taskCssContent, setTaskCssContent] = useState<string>('');
  const [taskJsFiles, setTaskJsFiles] = useState<{ id: string; name: string; content: string }[]>([]);
  const [isLoadingTaskFiles, setIsLoadingTaskFiles] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Web files drafts (uploaded files + additional JS files)
  const webFilesDrafts = useWebFileDrafts({ taskId });
  const { uploadedFiles, additionalJsFiles } = webFilesDrafts;

  // Combine task attachments with user uploaded files
  const allFiles = [...taskAttachments, ...uploadedFiles];

  // Load task CSS/JS file content on mount
  useEffect(() => {
    const loadTaskFileContents = async () => {
      if (taskAttachments.length === 0) return;
      
      setIsLoadingTaskFiles(true);
      
      try {
        // Load CSS content (only first one if multiple)
        const cssFile = taskAttachments.find(f => f.type === 'css');
        if (cssFile) {
          const response = await fetch(cssFile.url);
          if (response.ok) {
            const content = await response.text();
            setTaskCssContent(content);
          }
        }
        
        // Load JS files content
        const jsFiles = taskAttachments.filter(f => f.type === 'js');
        const loadedJsFiles = await Promise.all(
          jsFiles.map(async (file, index) => {
            try {
              const response = await fetch(file.url);
              if (response.ok) {
                const content = await response.text();
                return { id: `task-js-${index}`, name: file.name, content };
              }
            } catch (e) {
              console.error('Error loading JS file:', file.name, e);
            }
            return { id: `task-js-${index}`, name: file.name, content: `// Errore nel caricamento di ${file.name}` };
          })
        );
        setTaskJsFiles(loadedJsFiles);
      } catch (error) {
        console.error('Error loading task file contents:', error);
      } finally {
        setIsLoadingTaskFiles(false);
      }
    };
    
    loadTaskFileContents();
  }, [taskAttachments]);

  // Build effective default CSS (task CSS + default)
  const effectiveDefaultCss = taskCssContent 
    ? `${taskCssContent}\n\n/* --- Il tuo CSS --- */\n${defaultCssCode || FALLBACK_CSS}`
    : (defaultCssCode || FALLBACK_CSS);

  const effectiveDefaultHtml = defaultHtmlCode || FALLBACK_HTML;
  const effectiveDefaultJs = defaultJsCode || FALLBACK_JS;

  // Use code drafts for each file type
  const htmlDraft = useCodeDraft({
    taskId,
    codeType: 'html',
    defaultCode: effectiveDefaultHtml,
  });

  const cssDraft = useCodeDraft({
    taskId,
    codeType: 'css',
    defaultCode: effectiveDefaultCss,
  });

  const jsDraft = useCodeDraft({
    taskId,
    codeType: 'js',
    defaultCode: effectiveDefaultJs,
  });

  const generatePreviewHtml = () => {
    // Build CSS includes only from user uploaded files (task CSS is already in the cssDraft)
    const cssIncludes = uploadedFiles
      .filter(f => f.type === 'css')
      .map(f => `<link rel="stylesheet" href="${f.url}">`)
      .join('\n');

    // Build JS includes only from user uploaded files
    const jsIncludes = uploadedFiles
      .filter(f => f.type === 'js')
      .map(f => `<script src="${f.url}"></script>`)
      .join('\n');

    // Task JS files content (already loaded)
    const taskJsCode = taskJsFiles.map(f => f.content).join('\n\n');

    // Combine all additional JS code from user
    const additionalJsCode = additionalJsFiles.map(f => f.code).join('\n\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>${cssDraft.code}</style>
        ${cssIncludes}
      </head>
      <body>
        ${htmlDraft.code.replace(/<!DOCTYPE html>|<\/?html>|<\/?head>|<\/?body>|<link[^>]*>/gi, '')}
        ${jsIncludes}
        <script>${taskJsCode}</script>
        <script>${jsDraft.code}</script>
        <script>${additionalJsCode}</script>
      </body>
      </html>
    `;
  };

  const openPreviewInNewTab = () => {
    const combinedHtml = generatePreviewHtml();
    const blob = new Blob([combinedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

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
        const fileType = getFileType(extension);
        
        if (!fileType) {
          toast({
            variant: 'destructive',
            title: 'Tipo di file non consentito',
            description: `Solo immagini, CSS, JS e HTML sono consentiti. .${extension} non è supportato`,
          });
          continue;
        }

        // Check CSS limit (only 1 CSS file allowed)
        if (fileType === 'css') {
          const existingCssCount = uploadedFiles.filter(f => f.type === 'css').length;
          if (existingCssCount >= 1) {
            toast({
              variant: 'destructive',
              title: 'Limite CSS raggiunto',
              description: 'È consentito solo 1 file CSS. Rimuovi quello esistente prima di caricarne un altro.',
            });
            continue;
          }
        }

        // Validate MIME type for images
        if (fileType === 'image' && !ALLOWED_MIME_TYPES.image.includes(file.type)) {
          toast({
            variant: 'destructive',
            title: 'Tipo di file non consentito',
            description: 'Tipo MIME non valido per immagine',
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

        // Only validate magic bytes for images
        if (fileType === 'image') {
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
        }

        const fileName = `${user.id}/${Date.now()}-${file.name}`;

        const { data, error } = await supabase.storage
          .from('web-compiler-assets')
          .upload(fileName, file, {
            contentType: fileType === 'css' ? 'text/css' : 
                         fileType === 'js' ? 'application/javascript' : 
                         fileType === 'html' ? 'text/html' : file.type
          });

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

        webFilesDrafts.addUploadedFile({
          name: file.name,
          url: urlData.publicUrl,
          type: fileType,
        });

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
      // Remove from state and save to DB (removeUploadedFile now auto-saves)
      await webFilesDrafts.removeUploadedFile(file.url);
      toast({
        title: 'File rimosso',
      });
    } catch (error) {
      console.error('Error removing file:', error);
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Impossibile rimuovere il file',
      });
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

  // Additional JS files management
  const addJsFile = () => {
    const newFile: JsFile = {
      id: `js-${Date.now()}`,
      name: `script${additionalJsFiles.length + 2}.js`,
      code: '// Nuovo file JavaScript\n',
    };
    webFilesDrafts.addJsFile(newFile);
    setActiveTab(newFile.id);
  };

  const updateJsFile = (id: string, code: string) => {
    webFilesDrafts.updateJsFile(id, code);
  };

  const removeJsFile = (id: string) => {
    webFilesDrafts.removeJsFile(id);
    setActiveTab('js');
  };

  const saveAllDrafts = async () => {
    await Promise.all([
      htmlDraft.saveDraft(),
      cssDraft.saveDraft(),
      jsDraft.saveDraft(),
      webFilesDrafts.saveDraft(),
    ]);
  };

  const resetAllCode = () => {
    htmlDraft.resetCode();
    cssDraft.resetCode();
    jsDraft.resetCode();
    webFilesDrafts.resetFiles();
  };

  const isSaving = htmlDraft.isSaving || cssDraft.isSaving || jsDraft.isSaving || webFilesDrafts.isSaving;
  const isLoading = htmlDraft.isLoading || cssDraft.isLoading || jsDraft.isLoading || webFilesDrafts.isLoading || isLoadingTaskFiles;

  const formatLastSaved = () => {
    const dates = [htmlDraft.lastSaved, cssDraft.lastSaved, jsDraft.lastSaved, webFilesDrafts.lastSaved].filter(Boolean) as Date[];
    if (dates.length === 0) return null;
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    return latest.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  // Group files by type for display - include both task attachments and user uploads
  const groupedFiles = {
    taskImages: taskAttachments.filter(f => f.type === 'image'),
    taskCss: taskAttachments.filter(f => f.type === 'css'),
    taskJs: taskAttachments.filter(f => f.type === 'js'),
    taskHtml: taskAttachments.filter(f => f.type === 'html'),
    images: uploadedFiles.filter(f => f.type === 'image'),
    css: uploadedFiles.filter(f => f.type === 'css'),
    js: uploadedFiles.filter(f => f.type === 'js'),
    html: uploadedFiles.filter(f => f.type === 'html'),
  };

  const hasTaskAttachments = taskAttachments.length > 0;

  // Generate preview URL for iframe
  const [previewUrl, setPreviewUrl] = useState<string>('');

  // Update preview URL when code changes
  useEffect(() => {
    const combinedHtml = generatePreviewHtml();
    const blob = new Blob([combinedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    
    // Cleanup old blob URL
    return () => URL.revokeObjectURL(url);
  }, [htmlDraft.code, cssDraft.code, jsDraft.code, additionalJsFiles, uploadedFiles, taskJsFiles]);

  // Fullscreen preview mode
  if (isPreviewFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
          <span className="text-sm font-medium text-foreground">Preview</span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={openPreviewInNewTab}
              title="Apri in nuova scheda"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsPreviewFullscreen(false)}
              title="Esci da schermo intero"
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <iframe
          src={previewUrl}
          title="Preview"
          className="flex-1 w-full bg-white"
          sandbox="allow-scripts"
        />
      </div>
    );
  }

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
            variant="ghost"
            size="sm"
            onClick={openPreviewInNewTab}
            title="Apri preview in nuova scheda"
          >
            <ExternalLink className="w-4 h-4" />
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
              accept="image/*,.css,.js,.html,.htm"
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
                  <span className="text-sm">Carica file o trascina qui</span>
                  <span className="text-xs">Immagini, CSS, JS, HTML</span>
                </div>
              )}
            </label>
          </div>

          {/* Task Attachments - Read Only */}
          {hasTaskAttachments && (
            <div className="space-y-3 mb-4 pb-4 border-b border-border">
              <span className="text-xs font-medium text-primary block">📌 Materiali della lezione</span>
              
              {/* Task Images */}
              {groupedFiles.taskImages.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">🖼️ Immagini</span>
                  <div className="space-y-1">
                    {groupedFiles.taskImages.map((file, index) => (
                      <TaskFileItem key={index} file={file} onCopy={copyUrl} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Task CSS */}
              {groupedFiles.taskCss.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">🎨 CSS (auto-inclusi)</span>
                  <div className="space-y-1">
                    {groupedFiles.taskCss.map((file, index) => (
                      <TaskFileItem key={index} file={file} onCopy={copyUrl} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Task JS */}
              {groupedFiles.taskJs.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">⚡ JavaScript (auto-inclusi)</span>
                  <div className="space-y-1">
                    {groupedFiles.taskJs.map((file, index) => (
                      <TaskFileItem key={index} file={file} onCopy={copyUrl} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Task HTML */}
              {groupedFiles.taskHtml.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">📄 HTML</span>
                  <div className="space-y-1">
                    {groupedFiles.taskHtml.map((file, index) => (
                      <TaskFileItem key={index} file={file} onCopy={copyUrl} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User Uploaded Files List - Grouped by type */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              <span className="text-xs font-medium text-muted-foreground block">📁 I tuoi file</span>
              
              {/* Images */}
              {groupedFiles.images.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">🖼️ Immagini</span>
                  <div className="space-y-1">
                    {groupedFiles.images.map((file, index) => (
                      <FileItem key={index} file={file} onCopy={copyUrl} onRemove={removeFile} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* CSS */}
              {groupedFiles.css.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">🎨 CSS (auto-inclusi)</span>
                  <div className="space-y-1">
                    {groupedFiles.css.map((file, index) => (
                      <FileItem key={index} file={file} onCopy={copyUrl} onRemove={removeFile} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* JS */}
              {groupedFiles.js.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">⚡ JavaScript (auto-inclusi)</span>
                  <div className="space-y-1">
                    {groupedFiles.js.map((file, index) => (
                      <FileItem key={index} file={file} onCopy={copyUrl} onRemove={removeFile} />
                    ))}
                  </div>
                </div>
              )}
              
              {/* HTML */}
              {groupedFiles.html.length > 0 && (
                <div>
                  <span className="text-xs text-muted-foreground mb-1 block">📄 HTML</span>
                  <div className="space-y-1">
                    {groupedFiles.html.map((file, index) => (
                      <FileItem key={index} file={file} onCopy={copyUrl} onRemove={removeFile} />
                    ))}
                  </div>
                </div>
              )}
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
            <div className="flex items-center border-b border-border bg-muted/30">
              <TabsList className="flex-1 justify-start rounded-none bg-transparent h-auto p-0">
                <TabsTrigger value="html" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                  HTML
                </TabsTrigger>
                <TabsTrigger value="css" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                  CSS
                </TabsTrigger>
                <TabsTrigger value="js" className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                  main.js
                </TabsTrigger>
                {/* Task JS files (read-only tabs) */}
                {taskJsFiles.map((file) => (
                  <TabsTrigger 
                    key={file.id} 
                    value={file.id} 
                    className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary/70 text-primary/70"
                    title="File della lezione (sola lettura)"
                  >
                    📌 {file.name}
                  </TabsTrigger>
                ))}
                {/* User's additional JS files */}
                {additionalJsFiles.map((file) => (
                  <TabsTrigger 
                    key={file.id} 
                    value={file.id} 
                    className="data-[state=active]:bg-background rounded-none border-b-2 border-transparent data-[state=active]:border-primary group"
                  >
                    {file.name}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeJsFile(file.id);
                      }}
                      className="ml-1 opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </TabsTrigger>
                ))}
              </TabsList>
              <Button
                variant="ghost"
                size="sm"
                onClick={addJsFile}
                className="h-8 px-2"
                title="Aggiungi file JS"
              >
                <Plus className="w-4 h-4" />
                <span className="ml-1 text-xs">JS</span>
              </Button>
            </div>

            <TabsContent value="html" className="flex-1 m-0 overflow-hidden bg-[#1e1e1e]">
              <CodeEditor
                code={htmlDraft.code}
                onChange={htmlDraft.setCode}
                language="html"
                className="h-full"
              />
            </TabsContent>
            <TabsContent value="css" className="flex-1 m-0 overflow-hidden bg-[#1e1e1e]">
              <CodeEditor
                code={cssDraft.code}
                onChange={cssDraft.setCode}
                language="css"
                className="h-full"
              />
            </TabsContent>
            <TabsContent value="js" className="flex-1 m-0 overflow-hidden bg-[#1e1e1e]">
              <CodeEditor
                code={jsDraft.code}
                onChange={jsDraft.setCode}
                language="javascript"
                className="h-full"
              />
            </TabsContent>
            {/* Task JS files content (read-only) */}
            {taskJsFiles.map((file) => (
              <TabsContent key={file.id} value={file.id} className="flex-1 m-0 overflow-hidden bg-[#1e1e1e] relative">
                <div className="absolute top-2 right-4 z-10 px-2 py-1 bg-primary/20 text-primary text-xs rounded">
                  📌 Sola lettura
                </div>
                <CodeEditor
                  code={file.content}
                  onChange={() => {}} // Read-only, no changes allowed
                  language="javascript"
                  className="h-full pointer-events-none opacity-90"
                />
              </TabsContent>
            ))}
            {/* User's additional JS files */}
            {additionalJsFiles.map((file) => (
              <TabsContent key={file.id} value={file.id} className="flex-1 m-0 overflow-hidden bg-[#1e1e1e]">
                <CodeEditor
                  code={file.code}
                  onChange={(code) => updateJsFile(file.id, code)}
                  language="javascript"
                  className="h-full"
                />
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* Preview */}
        <div className="h-1/3 min-h-[150px] border-t border-border">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
            <span className="text-xs font-medium text-muted-foreground">Preview</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={openPreviewInNewTab}
                title="Apri in nuova scheda"
                className="h-6 w-6 p-0"
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPreviewFullscreen(true)}
                title="Schermo intero"
                className="h-6 w-6 p-0"
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <iframe
            src={previewUrl}
            title="Preview"
            className="w-full h-[calc(100%-32px)] bg-white"
            sandbox="allow-scripts"
          />
        </div>
      </div>
    </div>
  );
}

// File item component for user uploaded files (with remove button)
function FileItem({ file, onCopy, onRemove }: { 
  file: UploadedFile; 
  onCopy: (url: string) => void; 
  onRemove: (file: UploadedFile) => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-background rounded border border-border">
      {getFileIcon(file.type)}
      <span className="text-sm truncate flex-1">{file.name}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onCopy(file.url)}
        title="Copia URL"
        className="h-6 w-6 p-0"
      >
        <Copy className="w-3 h-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(file)}
        className="text-destructive h-6 w-6 p-0"
        title="Rimuovi"
      >
        <Trash2 className="w-3 h-3" />
      </Button>
    </div>
  );
}

// File item component for task attachments (read-only, no remove button)
function TaskFileItem({ file, onCopy }: { 
  file: { name: string; url: string; type: 'image' | 'css' | 'js' | 'html' }; 
  onCopy: (url: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-primary/5 rounded border border-primary/20">
      {getFileIcon(file.type)}
      <span className="text-sm truncate flex-1">{file.name}</span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onCopy(file.url)}
        title="Copia URL"
        className="h-6 w-6 p-0"
      >
        <Copy className="w-3 h-3" />
      </Button>
    </div>
  );
}
