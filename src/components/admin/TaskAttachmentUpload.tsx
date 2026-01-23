import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Trash2, Copy, Image as ImageIcon, FileCode, FileText, Loader2, ExternalLink, Music, Video } from 'lucide-react';

interface Attachment {
  name: string;
  url: string;
  type: 'image' | 'css' | 'js' | 'html' | 'audio' | 'video';
}

interface TaskAttachmentUploadProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

const ALLOWED_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
  css: ['css'],
  js: ['js'],
  html: ['html', 'htm'],
  audio: ['mp3', 'wav', 'ogg'],
  video: ['mp4', 'webm']
};

const getFileType = (extension: string): 'image' | 'css' | 'js' | 'html' | 'audio' | 'video' | null => {
  for (const [type, extensions] of Object.entries(ALLOWED_EXTENSIONS)) {
    if (extensions.includes(extension.toLowerCase())) {
      return type as 'image' | 'css' | 'js' | 'html' | 'audio' | 'video';
    }
  }
  return null;
};

const getFileIcon = (type: 'image' | 'css' | 'js' | 'html' | 'audio' | 'video') => {
  switch (type) {
    case 'image':
      return <ImageIcon className="w-4 h-4 text-green-500" />;
    case 'css':
      return <FileCode className="w-4 h-4 text-blue-500" />;
    case 'js':
      return <FileCode className="w-4 h-4 text-yellow-500" />;
    case 'html':
      return <FileText className="w-4 h-4 text-orange-500" />;
    case 'audio':
      return <Music className="w-4 h-4 text-purple-500" />;
    case 'video':
      return <Video className="w-4 h-4 text-pink-500" />;
  }
};

export function TaskAttachmentUpload({ attachments, onAttachmentsChange }: TaskAttachmentUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const getFileExtension = (fileName: string): string => {
    const parts = fileName.toLowerCase().split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newAttachments: Attachment[] = [];

    try {
      for (const file of Array.from(files)) {
        const extension = getFileExtension(file.name);
        const fileType = getFileType(extension);
        
        if (!fileType) {
          toast({
            variant: 'destructive',
            title: 'Tipo di file non consentito',
            description: `Solo immagini, CSS, JS, HTML, MP3 e MP4 sono consentiti. .${extension} non è supportato`,
          });
          continue;
        }

        const maxSize = (fileType === 'video' || fileType === 'audio') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          toast({
            variant: 'destructive',
            title: 'File troppo grande',
            description: `${file.name} supera il limite di ${maxSize / (1024 * 1024)}MB`,
          });
          continue;
        }

        const fileName = `task-attachments/${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;

        const contentType = fileType === 'css' ? 'text/css' : 
                           fileType === 'js' ? 'application/javascript' : 
                           fileType === 'html' ? 'text/html' :
                           fileType === 'audio' ? 'audio/mpeg' :
                           fileType === 'video' ? 'video/mp4' : file.type;

        const { data, error } = await supabase.storage
          .from('web-compiler-assets')
          .upload(fileName, file, { contentType });

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

        newAttachments.push({
          name: file.name,
          url: urlData.publicUrl,
          type: fileType,
        });
      }

      // Update all attachments at once after the loop
      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments]);
        toast({
          title: 'File caricati',
          description: `${newAttachments.length} file caricati con successo`,
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

  const removeAttachment = async (attachment: Attachment) => {
    try {
      const path = attachment.url.split('/web-compiler-assets/')[1];
      if (path) {
        await supabase.storage.from('web-compiler-assets').remove([decodeURIComponent(path)]);
      }
      onAttachmentsChange(attachments.filter(a => a.url !== attachment.url));
      toast({
        title: 'File rimosso',
      });
    } catch (error) {
      console.error('Error removing file:', error);
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: 'URL copiato',
      description: 'Incollalo nel codice HTML',
    });
  };

  const groupedFiles = {
    images: attachments.filter(f => f.type === 'image'),
    css: attachments.filter(f => f.type === 'css'),
    js: attachments.filter(f => f.type === 'js'),
    html: attachments.filter(f => f.type === 'html'),
    audio: attachments.filter(f => f.type === 'audio'),
    video: attachments.filter(f => f.type === 'video'),
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div 
        className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
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
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.css,.js,.html,.htm,.mp3,.wav,.ogg,.mp4,.webm"
          multiple
          onChange={handleFileUpload}
        />
        
        {isUploading ? (
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Caricamento...</span>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Trascina file qui o{' '}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => fileInputRef.current?.click()}
              >
                sfoglia
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              Immagini, CSS, JS, HTML, MP3, MP4 - Max 10MB (50MB per audio/video)
            </p>
          </div>
        )}
      </div>

      {/* File List */}
      {attachments.length > 0 && (
        <div className="space-y-3">
          {groupedFiles.images.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Immagini ({groupedFiles.images.length})
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {groupedFiles.images.map((file) => (
                  <div key={file.url} className="relative group rounded-lg overflow-hidden border border-border">
                    <img 
                      src={file.url} 
                      alt={file.name} 
                      className="w-full h-20 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white hover:bg-white/20"
                        onClick={() => copyUrl(file.url)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white hover:bg-white/20"
                        onClick={() => window.open(file.url, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/20"
                        onClick={() => removeAttachment(file)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-2 py-1 truncate">
                      {file.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {[...groupedFiles.css, ...groupedFiles.js, ...groupedFiles.html, ...groupedFiles.audio, ...groupedFiles.video].length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <FileCode className="w-3 h-3" /> File Codice e Media
              </p>
              <div className="space-y-1">
                {[...groupedFiles.css, ...groupedFiles.js, ...groupedFiles.html, ...groupedFiles.audio, ...groupedFiles.video].map((file) => (
                  <div 
                    key={file.url} 
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(file.type)}
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyUrl(file.url)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => window.open(file.url, '_blank')}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => removeAttachment(file)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
