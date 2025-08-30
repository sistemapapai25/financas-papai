import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, FileText, ExternalLink } from 'lucide-react';

interface FileUploadProps {
  label: string;
  value?: string;
  onChange: (url: string | null) => void;
  bucket: string;
  folder: string;
  accept?: string;
}

const FileUpload = ({ label, value, onChange, bucket, folder, accept = "*" }: FileUploadProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onChange(data.publicUrl);

      toast({
        title: "Sucesso",
        description: "Arquivo enviado com sucesso!",
      });
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar arquivo. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
  };

  const openFile = () => {
    if (value) {
      window.open(value, '_blank');
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {value ? (
        <div className="flex items-center gap-2 p-3 border rounded-md">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm flex-1 truncate">Arquivo enviado</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={openFile}
            className="h-8 w-8 p-0"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            className="h-8 w-8 p-0 text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            type="file"
            onChange={handleFileUpload}
            disabled={loading}
            accept={accept}
            className="cursor-pointer"
          />
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Upload className="h-4 w-4 animate-spin" />
              Enviando arquivo...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUpload;