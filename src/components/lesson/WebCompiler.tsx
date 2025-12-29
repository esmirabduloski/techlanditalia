import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Upload, Trash2, Copy, FolderOpen, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface UploadedFile {
  name: string;
  url: string;
}

export function WebCompiler() {
  const [htmlCode, setHtmlCode] = useState<string>(`<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Ciao, Mondo!</h1>
  <p>Modifica questo codice per vedere i cambiamenti.</p>
</body>
</html>`);
  const [cssCode, setCssCode] = useState<string>(`body {
  font-family: Arial, sans-serif;
  padding: 20px;
  background-color: #f0f0f0;
}

h1 {
  color: #333;
}

p {
  color: #666;
}`);
  const [jsCode, setJsCode] = useState<string>('// JavaScript opzionale\nconsole.log("Hello from JavaScript!");');
  const [activeTab, setActiveTab] = useState<string>('html');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showFileManager, setShowFileManager] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    updatePreview();
  }, [htmlCode, cssCode, jsCode]);

  const updatePreview = () => {
    if (!iframeRef.current) return;

    const combinedHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>${cssCode}</style>
      </head>
      <body>
        ${htmlCode.replace(/<!DOCTYPE html>|<\/?html>|<\/?head>|<\/?body>|<link[^>]*>/gi, '')}
        <script>${jsCode}</script>
      </body>
      </html>
    `;

    const blob = new Blob([combinedHtml], { type: 'text/html' });
    iframeRef.current.src = URL.createObjectURL(blob);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0 || !user) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
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

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">🌐 Web Editor</span>
        </div>
        <div className="flex items-center gap-2">
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
              value={htmlCode}
              onChange={(e) => setHtmlCode(e.target.value)}
              className="w-full h-full p-4 font-mono text-sm bg-background text-foreground resize-none focus:outline-none"
              spellCheck={false}
            />
          </TabsContent>
          <TabsContent value="css" className="flex-1 m-0 overflow-hidden">
            <textarea
              value={cssCode}
              onChange={(e) => setCssCode(e.target.value)}
              className="w-full h-full p-4 font-mono text-sm bg-background text-foreground resize-none focus:outline-none"
              spellCheck={false}
            />
          </TabsContent>
          <TabsContent value="js" className="flex-1 m-0 overflow-hidden">
            <textarea
              value={jsCode}
              onChange={(e) => setJsCode(e.target.value)}
              className="w-full h-full p-4 font-mono text-sm bg-background text-foreground resize-none focus:outline-none"
              spellCheck={false}
            />
          </TabsContent>
        </Tabs>

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
