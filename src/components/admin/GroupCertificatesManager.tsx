import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, File, Image, Loader2, FileText } from 'lucide-react';

interface CertificateFile {
  path: string;
  name: string;
  type: string;
}

interface GroupCertificatesManagerProps {
  groupId: string;
  certificates: CertificateFile[];
  onUpdate: (certificates: CertificateFile[]) => void;
}

export function GroupCertificatesManager({ groupId, certificates, onUpdate }: GroupCertificatesManagerProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'];
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFiles = async (files: FileList) => {
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast({ variant: 'destructive', title: 'Tipo non consentito', description: `${file.name}: solo immagini e PDF` });
        continue;
      }
      if (file.size > MAX_SIZE) {
        toast({ variant: 'destructive', title: 'File troppo grande', description: `${file.name}: max 10MB` });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setIsUploading(true);
    const newCerts: CertificateFile[] = [...certificates];

    try {
      for (const file of validFiles) {
        const ext = file.name.split('.').pop();
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '-');
        const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const filePath = `${groupId}/${baseName}-${uniqueId}.${ext}`;

        const { error } = await supabase.storage
          .from('group-certificates')
          .upload(filePath, file);

        if (error) {
          toast({ variant: 'destructive', title: 'Errore upload', description: `${file.name}: ${error.message}` });
          continue;
        }

        newCerts.push({ path: filePath, name: file.name, type: file.type });
      }

      // Save to DB
      const { error: updateError } = await supabase
        .from('student_groups')
        .update({ certificates: newCerts } as any)
        .eq('id', groupId);

      if (updateError) throw updateError;

      onUpdate(newCerts);
      toast({ title: 'Certificati caricati', description: `${validFiles.length} file caricati` });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Errore', description: error.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (index: number) => {
    const cert = certificates[index];
    try {
      await supabase.storage.from('group-certificates').remove([cert.path]);
      const updated = certificates.filter((_, i) => i !== index);
      await supabase.from('student_groups').update({ certificates: updated } as any).eq('id', groupId);
      onUpdate(updated);
      toast({ title: 'File rimosso' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Errore', description: error.message });
    }
  };

  const getIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  return (
    <div className="space-y-3">
      <Label>Certificati del Gruppo ({certificates.length} file)</Label>

      {certificates.length > 0 && (
        <div className="space-y-2">
          {certificates.map((cert, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg border">
              <span className="text-primary">{getIcon(cert.type)}</span>
              <span className="text-sm truncate flex-1">{cert.name}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(idx)}>
                <X className="w-3 h-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Upload className="w-4 h-4 mr-2" />
        )}
        {isUploading ? 'Caricamento...' : 'Carica Immagini/PDF'}
      </Button>
      <p className="text-xs text-muted-foreground">
        Carica le certificazioni di fine corso (immagini o PDF, max 10MB ciascuno)
      </p>
    </div>
  );
}
