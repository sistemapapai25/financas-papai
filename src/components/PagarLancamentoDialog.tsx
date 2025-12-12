import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CreditCard,
  Calendar,
  DollarSign,
  UploadCloud,
  Building2,
  Wallet,
} from "lucide-react";

// 🔹 utils de data (sem UTC)
import { todayYMD, ymdToBr } from "@/utils/date";

/* ===================== Tipos ===================== */
type FormaPagamento =
  | "PIX"
  | "DINHEIRO"
  | "CARTAO"
  | "BOLETO"
  | "TRANSFERENCIA"
  | "OUTRO";

type ContaFinanceira = {
  id: string;
  user_id: string;
  tipo: "CAIXA" | "BANCO";
  nome: string;
  instituicao?: string | null;
  agencia?: string | null;
  numero?: string | null;
  saldo_inicial: number;
  created_at: string | null;
};

export type LancamentoMin = {
  id: string;
  descricao: string | null;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  tipo: "DESPESA" | "RECEITA";
  conta_id?: string | null;
  data_pagamento?: string | null;
  valor_pago?: number | null;
  comprovante_url?: string | null;
};

interface PagarLancamentoDialogProps {
  lancamento: LancamentoMin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/* ===================== Helpers ===================== */
const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ===================== Subcomponentes ===================== */

function ResumoLancamento({ l }: { l: LancamentoMin }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <div className="font-medium">{l.descricao ?? "Lançamento"}</div>
          <div className="text-muted-foreground text-xs">
            Vencimento: <span className="font-medium">{ymdToBr(l.vencimento)}</span>
          </div>
        </div>
        <Badge>{l.tipo === "DESPESA" ? "Despesa" : "Receita"}</Badge>
      </div>
      <div className="mt-2 text-sm">
        Valor original: <span className="font-semibold">{moeda(l.valor)}</span>
      </div>
    </div>
  );
}

function CampoDataValor({
  dataPagamento,
  setDataPagamento,
  valorPago,
  setValorPago,
  valorSugestao,
}: {
  dataPagamento: string;
  setDataPagamento: (v: string) => void;
  valorPago: string;
  setValorPago: (v: string) => void;
  valorSugestao: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4" /> Data do pagamento *
        </Label>
        <Input
          type="date"
          value={dataPagamento}
          onChange={(e) => setDataPagamento(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <DollarSign className="w-4 h-4" /> Valor pago *
        </Label>
        <Input
          inputMode="decimal"
          value={valorPago}
          onChange={(e) => setValorPago(e.target.value)}
        />
        <div className="text-xs text-muted-foreground">
          Sugestão: {moeda(valorSugestao)}
        </div>
      </div>
    </div>
  );
}

function CampoConta({
  contas,
  loading,
  contaId,
  setContaId,
}: {
  contas: ContaFinanceira[];
  loading: boolean;
  contaId: string;
  setContaId: (v: string) => void;
}) {
  const contasBanco = useMemo(
    () => contas.filter((c) => c.tipo === "BANCO"),
    [contas]
  );
  const contasCaixa = useMemo(
    () => contas.filter((c) => c.tipo === "CAIXA"),
    [contas]
  );

  if (loading) {
    return (
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Wallet className="w-4 h-4" /> Conta de saída *
        </Label>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando contas…
        </div>
      </div>
    );
  }

  if (contas.length === 0) {
    return (
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Wallet className="w-4 h-4" /> Conta de saída *
        </Label>
        <div className="text-sm text-muted-foreground">
          Nenhuma conta cadastrada. Cadastre em <b>Cadastros &gt; Contas Financeiras</b>.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <Wallet className="w-4 h-4" /> Conta de saída *
      </Label>
      <Select value={contaId} onValueChange={setContaId}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a conta" />
        </SelectTrigger>
        <SelectContent>
          {contasBanco.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs text-muted-foreground">Bancos</div>
              {contasBanco.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{c.nome}</span>
                  </div>
                </SelectItem>
              ))}
              <Separator className="my-1" />
            </>
          )}
          {contasCaixa.length > 0 && (
            <>
              <div className="px-2 py-1 text-xs text-muted-foreground">Caixas</div>
              {contasCaixa.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>{c.nome}</span>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function CampoFormaPagamento({
  formaPagamento,
  setFormaPagamento,
}: {
  formaPagamento: FormaPagamento;
  setFormaPagamento: (v: FormaPagamento) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <CreditCard className="w-4 h-4" /> Forma de pagamento
      </Label>
      <Select value={formaPagamento} onValueChange={(v: FormaPagamento) => setFormaPagamento(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PIX">PIX</SelectItem>
          <SelectItem value="DINHEIRO">DINHEIRO</SelectItem>
          <SelectItem value="CARTAO">CARTÃO</SelectItem>
          <SelectItem value="BOLETO">BOLETO</SelectItem>
          <SelectItem value="TRANSFERENCIA">TRANSFERÊNCIA</SelectItem>
          <SelectItem value="OUTRO">OUTRO</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function CampoObservacoes({
  observacoes,
  setObservacoes,
}: {
  observacoes: string;
  setObservacoes: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>Observações</Label>
      <Textarea
        placeholder="Anotações adicionais (opcional)"
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
        rows={3}
      />
    </div>
  );
}

function CampoComprovante({
  file,
  setFile,
}: {
  file: File | null;
  setFile: (f: File | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5">
        <UploadCloud className="w-4 h-4" /> Comprovante (PDF/JPG/PNG) — opcional
      </Label>
      <Input
        type="file"
        accept=".pdf,image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <div className="text-xs text-muted-foreground">
        Se enviado, o link ficará associado ao lançamento como <code>comprovante_url</code>.
      </div>
      {file && (
        <div className="text-xs text-muted-foreground">
          Selecionado: <b>{file.name}</b>
        </div>
      )}
    </div>
  );
}

/* ===================== Componente Principal ===================== */

export default function PagarLancamentoDialog({
  lancamento,
  open,
  onOpenChange,
  onSuccess,
}: PagarLancamentoDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [contas, setContas] = useState<ContaFinanceira[]>([]);
  const [loadingContas, setLoadingContas] = useState(false);

  // 🟢 data local YYYY-MM-DD (sem UTC)
  const [dataPagamento, setDataPagamento] = useState<string>(() => todayYMD());
  const [contaId, setContaId] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("PIX");
  const [valorPago, setValorPago] = useState<string>(String(lancamento?.valor ?? ""));
  const [observacoes, setObservacoes] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);

  const [salvando, setSalvando] = useState(false);

  // Carrega contas do usuário quando abrir o diálogo
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadingContas(true);
      const { data, error } = await supabase
        .from("contas_financeiras")
        .select("*")
        .order("tipo", { ascending: true })
        .order("nome", { ascending: true });

      if (error) {
        toast({
          title: "Erro",
          description: "Não foi possível carregar as contas financeiras.",
          variant: "destructive",
        });
      } else {
        setContas((data ?? []).map(c => ({ ...c, tipo: c.tipo as "BANCO" | "CAIXA" })));
        if (!contaId && data && data.length) {
          const prefer = data.find((c) => c.tipo === "BANCO") ?? data[0];
          setContaId(prefer.id);
        }
      }
      setLoadingContas(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset de campos ao abrir
  useEffect(() => {
    if (open) {
      setDataPagamento(todayYMD());
      setValorPago(String(lancamento?.valor ?? ""));
    }
  }, [open, lancamento?.id]);

  async function uploadComprovanteIfNeeded(): Promise<string | null> {
    if (!file) return null;

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
      const path = `comprovantes/${user?.id ?? "anon"}/${lancamento.id}-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("comprovantes")
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("comprovantes").getPublicUrl(path);
      return pub?.publicUrl ?? null;
    } catch (e) {
      console.error("Upload erro:", e);
      toast({
        title: "Aviso",
        description:
          "Não foi possível enviar o comprovante. Você pode salvar o pagamento mesmo assim.",
      });
      return null;
    }
  }

  async function confirmarPagamento() {
    if (!user?.id) {
      toast({
        title: "Sessão",
        description: "Usuário não autenticado.",
        variant: "destructive",
      });
      return;
    }
    if (!contaId) {
      toast({
        title: "Atenção",
        description: "Selecione uma conta (CAIXA/BANCO).",
        variant: "destructive",
      });
      return;
    }
    if (!dataPagamento) {
      toast({
        title: "Atenção",
        description: "Informe a data do pagamento.",
        variant: "destructive",
      });
      return;
    }
    const valorNumber = Number((valorPago || "0").replace(",", "."));
    if (!isFinite(valorNumber) || valorNumber <= 0) {
      toast({
        title: "Atenção",
        description: "Informe um valor pago válido.",
        variant: "destructive",
      });
      return;
    }

    setSalvando(true);

    try {
      // 1) Upload de comprovante (opcional)
      const comprovanteUrl = await uploadComprovanteIfNeeded();

      // 2) Atualiza lançamento
      const { error: upErr } = await supabase
        .from("lancamentos")
        .update({
          status: "PAGO",
          data_pagamento: dataPagamento, // YYYY-MM-DD (DATE)
          valor_pago: valorNumber,
          conta_id: contaId,
          forma_pagamento: formaPagamento,
          observacoes: observacoes?.trim() ? observacoes.trim() : null,
          ...(comprovanteUrl ? { comprovante_url: comprovanteUrl } : {}),
        })
        .eq("id", lancamento.id);

      if (upErr) throw upErr;

      // 3) Registra movimento financeiro (SAÍDA)
      const { error: movErr } = await supabase.from("movimentos_financeiros").insert([
        {
          user_id: user.id,
          conta_id: contaId,
          data: dataPagamento, // YYYY-MM-DD (DATE)
          tipo: "SAIDA",
          valor: valorNumber,
          descricao: `Pagamento: ${lancamento.descricao ?? "Lançamento"}`,
          origem: "LANCAMENTO",
          ref_id: lancamento.id,
        },
      ]);
      if (movErr) throw movErr;

      toast({
        title: "Sucesso",
        description: "Pagamento registrado e movimento financeiro criado!",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro",
        description: e?.message || "Não foi possível registrar o pagamento.",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirmar Pagamento</DialogTitle>
          <DialogDescription>
            Defina os detalhes do pagamento deste lançamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ResumoLancamento l={lancamento} />

          <CampoDataValor
            dataPagamento={dataPagamento}
            setDataPagamento={setDataPagamento}
            valorPago={valorPago}
            setValorPago={setValorPago}
            valorSugestao={lancamento.valor}
          />

          <CampoConta
            contas={contas}
            loading={loadingContas}
            contaId={contaId}
            setContaId={setContaId}
          />

          <CampoFormaPagamento
            formaPagamento={formaPagamento}
            setFormaPagamento={setFormaPagamento}
          />

          <CampoObservacoes
            observacoes={observacoes}
            setObservacoes={setObservacoes}
          />

          <CampoComprovante file={file} setFile={setFile} />
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={confirmarPagamento} disabled={salvando || contas.length === 0}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
