import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, File, FileText, Image, Award, Loader2 } from 'lucide-react';

interface CertificateFile {
  path: string;
  name: string;
  type: string;
}

interface GroupCertificatesViewerProps {
  certificates: CertificateFile[];
}

export function GroupCertificatesViewer({ certificates }: GroupCertificatesViewerProps) {
  const [downloading, setDownloading] = useState<number | null>(null);
  const { toast } = useToast();

  const handleDownload = async (cert: CertificateFile, idx: number) => {
    setDownloading(idx);
    try {
      const { data, error } = await supabase.storage
        .from('group-certificates')
        .createSignedUrl(cert.path, 3600);

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Errore', description: error.message });
    } finally {
      setDownloading(null);
    }
  };

  const getIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  if (certificates.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5" />
          Certificati del Gruppo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {certificates.map((cert, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
              <span className="text-primary">{getIcon(cert.type)}</span>
              <span className="text-sm truncate flex-1">{cert.name}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(cert, idx)}
                disabled={downloading === idx}
              >
                {downloading === idx ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                Scarica
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
