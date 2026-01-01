import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, File, Image, FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSignedUrl } from '@/hooks/useSignedUrl';

interface FileUploadProps {
  onFileUploaded: (fileUrl: string, fileName: string, fileType: string) => void;
  existingFile?: {
    url: string; // Can be a full URL (legacy) or a path (new format)
    name: string;
    type: string;
  } | null;
  onRemoveFile?: () => void;
}

export function FileUpload({ onFileUploaded, existingFile, onRemoveFile }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // Allowed file types - expanded for course-specific files
  const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
    'pdf', 'txt', 'doc', 'docx', 'zip',
    'py', 'html', 'htm', 'css', 'js', 'json', 'md', 'lua',
    'rbxl', 'rbxlx', 'rbxm', 'rbxmx',
    'mp4', 'webm', 'mp3', 'wav'
  ];
  const ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf', 'text/plain', 'text/html', 'text/css', 'text/javascript',
    'application/javascript', 'text/x-python', 'application/x-python', 'application/json',
    'text/markdown', 'text/x-lua',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip', 'application/x-zip-compressed', 'application/octet-stream',
    'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav'
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

  const handleFile = async (file: File) => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: 'Devi essere loggato per caricare file',
      });
      return;
    }

    // Client-side validation first (fast feedback)
    const extension = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      toast({
        variant: 'destructive',
        title: 'Tipo di file non consentito',
        description: `I file .${extension} non sono supportati`,
      });
      return;
    }

    // MIME type check - be more permissive for code files
    const isCodeFile = ['py', 'html', 'htm', 'css', 'js', 'json', 'md', 'lua'].includes(extension);
    const isRobloxFile = ['rbxl', 'rbxlx', 'rbxm', 'rbxmx'].includes(extension);
    
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !isCodeFile && !isRobloxFile) {
      toast({
        variant: 'destructive',
        title: 'Tipo di file non consentito',
        description: 'Formato file non supportato',
      });
      return;
    }

    // Max 20MB
    if (file.size > 20 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File troppo grande',
        description: 'Il file non può superare i 20MB',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Read magic bytes for server-side validation
      const fileBytes = await readFileBytes(file);

      // Server-side validation
      const { data: validationResult, error: validationError } = await supabase.functions.invoke(
        'validate-file-upload',
        {
          body: {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            fileBytes,
            bucket: 'homework-files'
          }
        }
      );

      if (validationError) {
        throw new Error('Errore durante la validazione del file');
      }

      if (!validationResult.valid) {
        throw new Error(validationResult.error || 'File non valido');
      }

      const fileName = `${user.id}/${Date.now()}-${file.name}`;

      const { data, error } = await supabase.storage
        .from('homework-files')
        .upload(fileName, file);

      if (error) throw error;

      // Use signed URL since bucket is now private for security
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('homework-files')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year validity

      if (signedUrlError) throw signedUrlError;

      // Store the file path (without signed token) for future signed URL generation
      onFileUploaded(fileName, file.name, file.type);

      toast({
        title: 'File caricato',
        description: `${file.name} caricato con successo`,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Errore upload',
        description: error.message || 'Impossibile caricare il file',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (fileType.includes('pdf')) return <FileText className="w-5 h-5" />;
    return <File className="w-5 h-5" />;
  };

  // Generate signed URL for existing file (handles both legacy URLs and new paths)
  const { signedUrl, isLoading: isLoadingUrl } = useSignedUrl(
    'homework-files',
    existingFile?.url || null,
    3600 // 1 hour validity
  );

  if (existingFile) {
    return (
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
        <div className="text-primary">
          {getFileIcon(existingFile.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{existingFile.name}</p>
          {isLoadingUrl ? (
            <span className="text-xs text-muted-foreground">Caricamento...</span>
          ) : signedUrl ? (
            <a 
              href={signedUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Visualizza file
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">File non disponibile</span>
          )}
        </div>
        {onRemoveFile && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemoveFile}
            className="text-destructive hover:text-destructive"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragActive 
          ? 'border-primary bg-primary/5' 
          : 'border-border hover:border-primary/50'
      }`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleChange}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.txt,.zip,.py,.html,.htm,.css,.js,.json,.md,.lua,.rbxl,.rbxlx,.rbxm,.rbxmx,.mp4,.webm,.mp3,.wav"
      />

      {isUploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Caricamento in corso...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Trascina un file qui o{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-primary hover:underline"
              >
                sfoglia
              </button>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Immagini, PDF, codice (.py, .html, .css), file Roblox, video (max 20MB)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
