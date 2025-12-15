import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Image as ImageIcon, Eye } from 'lucide-react';

export default function ConfiguracaoIgreja() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({
    igreja_nome: '',
    igreja_cnpj: '',
    responsavel_nome: '',
    responsavel_cpf: '',
    assinatura_path: '' as string | null,
  });
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ igreja_nome?: string; igreja_cnpj?: string; responsavel_nome?: string; responsavel_cpf?: string }>({});

  function onlyDigits(s: string) { return s.replace(/\D+/g, ''); }
  function formatCPF(s: string) {
    const d = onlyDigits(s).slice(0, 11);
    const p1 = d.slice(0, 3);
    const p2 = d.slice(3, 6);
    const p3 = d.slice(6, 9);
    const p4 = d.slice(9, 11);
    let out = '';
    if (p1) out += p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '-' + p4;
    return out;
  }
  function formatCNPJ(s: string) {
    const d = onlyDigits(s).slice(0, 14);
    const p1 = d.slice(0, 2);
    const p2 = d.slice(2, 5);
    const p3 = d.slice(5, 8);
    const p4 = d.slice(8, 12);
    const p5 = d.slice(12, 14);
    let out = '';
    if (p1) out += p1;
    if (p2) out += '.' + p2;
    if (p3) out += '.' + p3;
    if (p4) out += '/' + p4;
    if (p5) out += '-' + p5;
    return out;
  }
  function isValidCPF(s: string) {
    const d = onlyDigits(s);
    if (!d || d.length !== 11) return false;
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (base: number) => {
      let sum = 0;
      for (let i = 0; i < base; i++) sum += parseInt(d.charAt(i), 10) * (base + 1 - i);
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(9);
    const d2 = calc(10);
    return d1 === parseInt(d.charAt(9), 10) && d2 === parseInt(d.charAt(10), 10);
  }
  function isValidCNPJ(s: string) {
    const d = onlyDigits(s);
    if (!d || d.length !== 14) return false;
    if (/^(\d)\1+$/.test(d)) return false;
    const weights1 = [5,4,3,2,9,8,7,6,5,4,3,2];
    const weights2 = [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const calc = (weights: number[]) => {
      let sum = 0;
      for (let i = 0; i < weights.length; i++) sum += parseInt(d.charAt(i), 10) * weights[i];
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(weights1);
    const d2 = calc(weights2);
    return d1 === parseInt(d.charAt(12), 10) && d2 === parseInt(d.charAt(13), 10);
  }

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('church_settings')
        .select('igreja_nome, igreja_cnpj, responsavel_nome, responsavel_cpf, assinatura_path')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) {
        toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        return;
      }
      if (data) {
        setForm({
          igreja_nome: data.igreja_nome,
          igreja_cnpj: formatCNPJ(data.igreja_cnpj || ''),
          responsavel_nome: data.responsavel_nome,
          responsavel_cpf: formatCPF(data.responsavel_cpf || ''),
          assinatura_path: data.assinatura_path ?? '',
        });
        if (data.assinatura_path) {
          const { data: signed } = await supabase.storage.from('Assinaturas').createSignedUrl(data.assinatura_path, 600);
          setPreviewUrl(signed?.signedUrl ?? null);
        }
      }
    })();
  }, [user]);

  const uploadAssinatura = async (file: File) => {
    if (!user) return;
    try {
      setLoading(true);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `assinaturas/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('Assinaturas').upload(path, file, { contentType: file.type || 'image/png', upsert: false });
      if (upErr) throw upErr;
      setForm(prev => ({ ...prev, assinatura_path: path }));
      const { data: signed } = await supabase.storage.from('Assinaturas').createSignedUrl(path, 600);
      setPreviewUrl(signed?.signedUrl ?? null);
      toast({ title: 'Assinatura', description: 'Imagem enviada com sucesso' });
    } catch (e: unknown) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha no upload', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const salvar = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const payload = {
        user_id: user.id,
        igreja_nome: form.igreja_nome,
        igreja_cnpj: onlyDigits(form.igreja_cnpj),
        responsavel_nome: form.responsavel_nome,
        responsavel_cpf: onlyDigits(form.responsavel_cpf),
        assinatura_path: form.assinatura_path || null,
        updated_at: new Date().toISOString(),
      };
      const errs: typeof errors = {};
      if (!payload.igreja_nome) errs.igreja_nome = 'Informe o nome';
      if (!isValidCNPJ(form.igreja_cnpj)) errs.igreja_cnpj = 'CNPJ inválido';
      if (!payload.responsavel_nome) errs.responsavel_nome = 'Informe o responsável';
      if (!isValidCPF(form.responsavel_cpf)) errs.responsavel_cpf = 'CPF inválido';
      setErrors(errs);
      if (Object.keys(errs).length > 0) { toast({ title: 'Validação', description: 'Corrija os campos destacados', variant: 'destructive' }); setLoading(false); return; }
      const { error } = await supabase
        .from('church_settings')
        .upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      toast({ title: 'Configuração', description: 'Dados salvos com sucesso' });
    } catch (e: unknown) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao salvar', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const visualizarAssinatura = async () => {
    try {
      if (!form.assinatura_path) { toast({ title: 'Assinatura', description: 'Nenhuma imagem enviada', variant: 'destructive' }); return; }
      const { data: signed, error } = await supabase.storage.from('Assinaturas').createSignedUrl(form.assinatura_path, 600);
      let url = signed?.signedUrl || null;
      if (error || !url) {
        const { data: blobRes } = await supabase.storage.from('Assinaturas').download(form.assinatura_path);
        if (blobRes) {
          let blobToUse = blobRes;
          if (!blobRes.type || blobRes.type === 'application/octet-stream') {
            const ext = form.assinatura_path.split('.').pop()?.toLowerCase();
            const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
            const ab = await blobRes.arrayBuffer();
            blobToUse = new Blob([ab], { type: mime });
          }
          url = URL.createObjectURL(blobToUse);
        }
      }
      if (!url) { toast({ title: 'Assinatura', description: 'Imagem indisponível', variant: 'destructive' }); return; }
      setPreviewUrl(url);
      window.open(url, '_blank');
    } catch (e: unknown) {
      toast({ title: 'Erro', description: e instanceof Error ? e.message : 'Falha ao abrir imagem', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4">
      <Card>
        <CardHeader>
          <CardTitle>Configuração da Igreja</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome da Igreja</Label>
              <Input value={form.igreja_nome} onChange={(e) => setForm({ ...form, igreja_nome: e.target.value })} />
              {errors.igreja_nome && <div className="text-xs text-red-600">{errors.igreja_nome}</div>}
            </div>
            <div className="space-y-2">
              <Label>CNPJ</Label>
              <Input value={form.igreja_cnpj} onChange={(e) => setForm({ ...form, igreja_cnpj: formatCNPJ(e.target.value) })} />
              {errors.igreja_cnpj && <div className="text-xs text-red-600">{errors.igreja_cnpj}</div>}
            </div>
            <div className="space-y-2">
              <Label>Responsável (Nome)</Label>
              <Input value={form.responsavel_nome} onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })} />
              {errors.responsavel_nome && <div className="text-xs text-red-600">{errors.responsavel_nome}</div>}
            </div>
            <div className="space-y-2">
              <Label>Responsável (CPF)</Label>
              <Input value={form.responsavel_cpf} onChange={(e) => setForm({ ...form, responsavel_cpf: formatCPF(e.target.value) })} />
              {errors.responsavel_cpf && <div className="text-xs text-red-600">{errors.responsavel_cpf}</div>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assinatura (PNG/JPG)</Label>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline">
                <label className="cursor-pointer">
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAssinatura(f); }} />
                  <ImageIcon className="w-4 h-4 mr-2" /> Enviar Imagem
                </label>
              </Button>
              {form.assinatura_path && (
                <Button type="button" variant="outline" onClick={visualizarAssinatura}>
                  <Eye className="w-4 h-4 mr-2" /> Visualizar
                </Button>
              )}
            </div>
            {form.assinatura_path ? (
              <div className="text-xs text-muted-foreground">Armazenado em: {form.assinatura_path}</div>
            ) : null}
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={salvar} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
