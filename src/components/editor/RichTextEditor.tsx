import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import TextAlign from '@tiptap/extension-text-align';
import { Node, mergeAttributes } from '@tiptap/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Quote, 
  Heading1, 
  Heading2, 
  Heading3,
  Image as ImageIcon,
  Youtube as YoutubeIcon,
  Link as LinkIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo,
  Redo,
  Code,
  Video,
  Loader2,
  FolderOpen
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// All available storage buckets for upload
const STORAGE_BUCKETS = [
  { id: 'web-compiler-assets', name: 'Web - Assets Compilatore' },
  { id: 'python-lesson-material', name: 'Python - Materiale Lezioni' },
  { id: 'python-pro-lesson-material', name: 'Python Pro - Materiale Lezioni' },
  { id: 'roblox-lesson-material', name: 'Roblox - Materiale Lezioni' },
  { id: 'ro2-lesson-material', name: 'Roblox 2 - Materiale Lezioni' },
  { id: 'homework-attachments', name: 'Compiti - Allegati' },
];

// Custom Video Extension for MP4/MOV videos
const VideoExtension = Node.create({
  name: 'video',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'video',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, {
      class: 'rounded-lg max-w-full my-4',
      controls: true,
    })];
  },

  addCommands() {
    return {
      setVideo: (options: { src: string }) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: options,
        });
      },
    };
  },
});

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
}

// Declare module augmentation for custom commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

export default function RichTextEditor({ content, onChange }: RichTextEditorProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Drag and drop upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState(STORAGE_BUCKETS[0].id);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const editorRef = useRef<any>(null);
  const savedSelectionRef = useRef<{ from: number; to: number } | null>(null);

  // Upload file to Supabase storage
  const uploadFile = useCallback(async (file: File, bucket: string): Promise<string | null> => {
    try {
      // Keep original filename for SEO, add unique suffix before extension
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const filePath = `editor-uploads/${baseName}-${uniqueId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error(`Errore durante il caricamento: ${uploadError.message}`);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Errore durante il caricamento del file');
      return null;
    }
  }, []);

  // Process pending files after bucket selection
  const processPendingFiles = useCallback(async () => {
    if (!editorRef.current || pendingFiles.length === 0) return;
    
    setIsUploading(true);
    setUploadDialogOpen(false);
    
    for (const file of pendingFiles) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/') || 
                      file.name.toLowerCase().endsWith('.mov') || 
                      file.name.toLowerCase().endsWith('.mp4');

      if (!isImage && !isVideo) {
        toast.error(`Tipo file non supportato: ${file.type}`);
        continue;
      }

      const url = await uploadFile(file, selectedBucket);
      if (url) {
        // Restore cursor position to where the file was dropped
        if (savedSelectionRef.current) {
          editorRef.current.chain().focus().setTextSelection(savedSelectionRef.current.from).run();
        }
        
        if (isImage) {
          editorRef.current.chain().insertContentAt(
            savedSelectionRef.current?.from ?? editorRef.current.state.selection.from,
            { type: 'image', attrs: { src: url } }
          ).run();
        } else if (isVideo) {
          editorRef.current.chain().insertContentAt(
            savedSelectionRef.current?.from ?? editorRef.current.state.selection.from,
            { type: 'video', attrs: { src: url } }
          ).run();
        }
        toast.success('File caricato con successo');
      }
    }
    
    setPendingFiles([]);
    savedSelectionRef.current = null;
    setIsUploading(false);
  }, [pendingFiles, selectedBucket, uploadFile]);

  // Handle file drop - show dialog for bucket selection
  const handleFileDrop = useCallback((files: FileList, dropPosition?: number) => {
    const validFiles: File[] = [];
    
    for (const file of Array.from(files)) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/') || 
                      file.name.toLowerCase().endsWith('.mov') || 
                      file.name.toLowerCase().endsWith('.mp4');

      if (isImage || isVideo) {
        validFiles.push(file);
      } else {
        toast.error(`Tipo file non supportato: ${file.name}`);
      }
    }
    
    if (validFiles.length > 0) {
      // Save the drop position for later insertion
      if (dropPosition !== undefined) {
        savedSelectionRef.current = { from: dropPosition, to: dropPosition };
      } else if (editorRef.current) {
        savedSelectionRef.current = { 
          from: editorRef.current.state.selection.from, 
          to: editorRef.current.state.selection.to 
        };
      }
      setPendingFiles(validFiles);
      setUploadDialogOpen(true);
    }
  }, []);

  const editor = useEditor({
    extensions: ([
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-4',
        },
      }),
      VideoExtension,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline',
        },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
        HTMLAttributes: {
          class: 'rounded-lg my-4 w-full aspect-video',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[300px] p-4 focus:outline-none',
      },
      handleKeyDown: (_view, event) => {
        // Previeni che Enter si propaghi al form padre
        if (event.key === 'Enter') {
          event.stopPropagation();
          return false;
        }
        return false;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          event.preventDefault();
          return true; // We'll handle this in the component
        }
        return false;
      },
      handlePaste: (_view, event) => {
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
          event.preventDefault();
          return true; // We'll handle this in the component
        }
        return false;
      },
    },
  });

  // Sync content from parent
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Store editor reference for use in upload dialog
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  // Handle drop events on the editor container
  useEffect(() => {
    if (!editor) return;

    const editorElement = document.querySelector('.ProseMirror');
    if (!editorElement) return;

    const handleDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        
        // Get the drop position in the document
        const view = editor.view;
        const pos = view.posAtCoords({ left: e.clientX, top: e.clientY });
        const dropPosition = pos?.pos ?? editor.state.selection.from;
        
        handleFileDrop(e.dataTransfer.files, dropPosition);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        handleFileDrop(e.clipboardData.files);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    editorElement.addEventListener('drop', handleDrop as EventListener);
    editorElement.addEventListener('paste', handlePaste as EventListener);
    editorElement.addEventListener('dragover', handleDragOver as EventListener);

    return () => {
      editorElement.removeEventListener('drop', handleDrop as EventListener);
      editorElement.removeEventListener('paste', handlePaste as EventListener);
      editorElement.removeEventListener('dragover', handleDragOver as EventListener);
    };
  }, [editor, handleFileDrop]);

  const addImage = useCallback(() => {
    if (imageUrl && editor) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setImageDialogOpen(false);
    }
  }, [editor, imageUrl]);

  const addYoutubeVideo = useCallback(() => {
    if (youtubeUrl && editor) {
      editor.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run();
      setYoutubeUrl('');
      setYoutubeDialogOpen(false);
    }
  }, [editor, youtubeUrl]);

  const addVideo = useCallback(() => {
    if (videoUrl && editor) {
      editor.chain().focus().setVideo({ src: videoUrl }).run();
      setVideoUrl('');
      setVideoDialogOpen(false);
    }
  }, [editor, videoUrl]);

  const addLink = useCallback(() => {
    if (linkUrl && editor) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setLinkDialogOpen(false);
    }
  }, [editor, linkUrl]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-lg overflow-hidden bg-background relative">
      {/* Toolbar */}
      <div className="border-b bg-muted/50 p-2 flex flex-wrap gap-1">
        {/* Text Formatting */}
        <Button
          type="button"
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('code') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Headings */}
        <Button
          type="button"
          variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Alignment */}
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Lists */}
        <Button
          type="button"
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Media */}
        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <ImageIcon className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inserisci Immagine</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL Immagine</Label>
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://esempio.com/immagine.jpg"
                />
              </div>
              <Button onClick={addImage} className="w-full">
                Inserisci
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={youtubeDialogOpen} onOpenChange={setYoutubeDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <YoutubeIcon className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inserisci Video YouTube</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL YouTube</Label>
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </div>
              <Button onClick={addYoutubeVideo} className="w-full">
                Inserisci
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm">
              <Video className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inserisci Video (MP4/MOV)</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL Video</Label>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://esempio.com/video.mp4"
                />
              </div>
              <Button onClick={addVideo} className="w-full">
                Inserisci
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              type="button" 
              variant={editor.isActive('link') ? 'secondary' : 'ghost'} 
              size="sm"
            >
              <LinkIcon className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inserisci Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://esempio.com"
                />
              </div>
              <Button onClick={addLink} className="w-full">
                Inserisci
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo/Redo */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo className="w-4 h-4" />
        </Button>
      </div>

      {/* Upload indicator */}
      {isUploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Caricamento in corso...</span>
          </div>
        </div>
      )}

      {/* Editor Content */}
      <EditorContent editor={editor} className="min-h-[300px]" />
      
      {/* Drag hint */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-t">
        💡 Trascina immagini o video (MP4, MOV) direttamente nell'editor per caricarli automaticamente
      </div>

      {/* Upload folder selection dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        setUploadDialogOpen(open);
        if (!open) {
          setPendingFiles([]);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" />
              Scegli Cartella di Destinazione
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>File da caricare:</Label>
              <div className="text-sm text-muted-foreground bg-muted p-2 rounded-md">
                {pendingFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {file.type.startsWith('image/') ? (
                      <ImageIcon className="w-4 h-4" />
                    ) : (
                      <Video className="w-4 h-4" />
                    )}
                    <span>{file.name}</span>
                    <span className="text-xs">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cartella di destinazione</Label>
              <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una cartella" />
                </SelectTrigger>
                <SelectContent>
                  {STORAGE_BUCKETS.map((bucket) => (
                    <SelectItem key={bucket.id} value={bucket.id}>
                      {bucket.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={processPendingFiles} className="w-full">
              Carica File
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
