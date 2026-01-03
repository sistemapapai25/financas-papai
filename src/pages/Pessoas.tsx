import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

type PessoaRow = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  auth_user_id: string | null;
  created_at: string;
};

type ProfileOpt = {
  auth_user_id: string | null;
  email: string;
  name: string | null;
};

export default function Pessoas() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [rows, setRows] = useState<PessoaRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estados para criar/editar
  const [editId, setEditId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [authUserId, setAuthUserId] = useState<string>("__none__");

  const canManage = useMemo(() => !!user && !roleLoading && isAdmin, [user, roleLoading, isAdmin]);

  const resetForm = () => {
    setEditId(null);
    setNome("");
    setTelefone("");
    setEmail("");
    setAtivo(true);
    setAuthUserId("__none__");
  };

  const load = async () => {
    if (!user) return;
    if (!canManage) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("pessoas")
      .select("id,nome,telefone,email,ativo,auth_user_id,created_at")
      .order("nome", { ascending: true });
    setLoading(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setRows((data as PessoaRow[]) ?? []);
  };

  const loadProfiles = async () => {
    if (!user) return;
    if (!canManage) {
      setProfiles([]);
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("auth_user_id,email,name")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setProfiles((data as unknown as ProfileOpt[]) ?? []);
  };

  useEffect(() => {
    load();
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, canManage]);

  const handleSave = async () => {
    if (!canManage) return;
    if (!nome.trim()) {
      toast({ title: "Atenção", description: "Informe o nome.", variant: "destructive" });
      return;
    }
    if (!telefone.trim()) {
      toast({ title: "Atenção", description: "Informe o telefone.", variant: "destructive" });
      return;
    }

    const phoneDigits = telefone.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      toast({
        title: "Atenção",
        description: "Número errado. Verifique se o código DDD existe (11 dígitos).",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const payload = {
      nome: nome.trim(),
      telefone: telefone.trim() ? telefone.trim() : null,
      email: email.trim() ? email.trim() : null,
      ativo,
      auth_user_id: authUserId === "__none__" ? null : authUserId,
    };

    let error;
    if (editId) {
      // Editar
      const result = await supabase.from("pessoas").update(payload).eq("id", editId);
      error = result.error;
    } else {
      // Criar
      const result = await supabase.from("pessoas").insert(payload);
      error = result.error;
    }

    setSaving(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Sucesso", description: editId ? "Participante atualizado." : "Participante cadastrado." });
    resetForm();
    setOpen(false);
    load();
  };

  const openEdit = (row: PessoaRow) => {
    setEditId(row.id);
    setNome(row.nome);
    setTelefone(row.telefone ?? "");
    setEmail(row.email ?? "");
    setAtivo(row.ativo);
    setAuthUserId(row.auth_user_id ?? "__none__");
    setOpen(true);
  };

  const updateAuthUserId = async (row: PessoaRow, next: string) => {
    if (!canManage) return;
    const nextVal = next === "__none__" ? null : next;
    const { error } = await supabase.from("pessoas").update({ auth_user_id: nextVal }).eq("id", row.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, auth_user_id: nextVal } : r)));
  };

  const toggleAtivo = async (row: PessoaRow) => {
    if (!canManage) return;
    const { error } = await supabase.from("pessoas").update({ ativo: !row.ativo }).eq("id", row.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ativo: !r.ativo } : r)));
  };

  if (!user) return null;

  if (!roleLoading && !isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Participantes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Acesso restrito para administradores.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Participantes</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>Novo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? "Editar participante" : "Novo participante"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João Silva" required />
              </div>
              <div className="space-y-2">
                <Label>Telefone <span className="text-destructive">*</span></Label>
                <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Ex.: (11) 99999-9999" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Ex.: joao@email.com" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativo</Label>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum participante cadastrado.</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="w-28">Ativo</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.nome}</TableCell>
                      <TableCell>{r.telefone ?? "-"}</TableCell>
                      <TableCell>{r.email ?? "-"}</TableCell>
                      <TableCell>
                        <Switch checked={r.ativo} onCheckedChange={() => toggleAtivo(r)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)}>
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
