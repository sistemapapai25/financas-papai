// src/services/cultos.ts
import { supabase } from "@/lib/supabase";
import { getUserId } from "@/auth/session";

// Tipos
export type Culto = {
  id: string;
  data: string;
  tipo: string | null;
  pregador: string | null;
  adultos: number;
  criancas: number;
  created_at: string;
};

type DizimoItem = { nome: string; valor: number };

// Busca a categoria pelo NOME (filtra pelo usuário logado)
export async function getCategoriaId(nome: string) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", userId)
    .ilike("name", nome)
    .maybeSingle();

  if (error || !data) {
    throw new Error(`Categoria '${nome}' não encontrada para este usuário.`);
  }
  return data.id as string;
}

// Cria o culto (cabeçalho)
export async function criarCulto(input: {
  data: string; tipo_id?: string; pregador?: string; adultos?: number; criancas?: number;
}): Promise<Culto> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from("cultos")
    .insert({
      data: input.data,
      tipo_id: input.tipo_id ?? null,
      pregador: input.pregador ?? null,
      adultos: input.adultos ?? 0,
      criancas: input.criancas ?? 0,
      user_id: userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return { ...data, tipo: null } as Culto;
}

// Insere dízimos (por pessoa)
export async function inserirDizimos(cultoId: string, itens: DizimoItem[]) {
  const payload = itens
    .filter(i => i.nome && i.valor > 0)
    .map(i => ({ culto_id: cultoId, nome: i.nome.trim(), valor: i.valor }));
  if (payload.length === 0) return;
  const { error } = await supabase.from("dizimos").insert(payload);
  if (error) throw error;
}

// Insere ofertas (apenas valores)
export async function inserirOfertas(cultoId: string, valores: number[]) {
  const payload = valores
    .filter(v => v > 0)
    .map(v => ({ culto_id: cultoId, valor: v }));
  if (payload.length === 0) return;
  const { error } = await supabase.from("ofertas").insert(payload);
  if (error) throw error;
}

// Totais do culto (view)
export async function totaisDoCulto(cultoId: string) {
  const { data, error } = await supabase
    .from("vw_culto_totais")
    .select("*")
    .eq("culto_id", cultoId)
    .single();
  if (error) throw error;
  return {
    total_dizimos: Number(data.total_dizimos || 0),
    total_ofertas: Number(data.total_ofertas || 0),
  };
}

// Cria RECEITAS em `lancamentos` (um p/ Dízimos e um p/ Ofertas)
export async function criarLancamentosFinanceiros(params: {
  data: string; totalDizimos: number; totalOfertas: number;
}) {
  const user_id = await getUserId();

  type NovoLancamento = {
    tipo: "DESPESA" | "RECEITA";
    categoria_id: string;
    descricao: string;
    valor: number;
    vencimento: string;
    user_id: string;
  };
  const rows: NovoLancamento[] = [];
  if (params.totalDizimos > 0) {
    const catDiz = await getCategoriaId("Dízimos");
    rows.push({
      tipo: "RECEITA",
      categoria_id: catDiz,
      descricao: `Dízimos - culto ${params.data}`,
      valor: params.totalDizimos,
      vencimento: params.data, // sua tabela exige
      user_id,
    });
  }
  if (params.totalOfertas > 0) {
    const catOfe = await getCategoriaId("Ofertas");
    rows.push({
      tipo: "RECEITA",
      categoria_id: catOfe,
      descricao: `Ofertas - culto ${params.data}`,
      valor: params.totalOfertas,
      vencimento: params.data,
      user_id,
    });
  }
  if (rows.length === 0) return;

  // Evitar duplicações: verifica existentes por (user_id, categoria_id, descricao, valor, vencimento)
  const descricoes = rows.map(r => r.descricao);
  const { data: existentes } = await supabase
    .from("lancamentos")
    .select("id, categoria_id, descricao, valor, vencimento")
    .eq("user_id", user_id)
    .in("descricao", descricoes);

  const isDup = (r: NovoLancamento) => {
    const match = (existentes as { categoria_id: string; descricao: string | null; valor: number; vencimento: string }[] | null || [])
      .find((e) =>
        e.categoria_id === r.categoria_id &&
        (e.descricao || "") === r.descricao &&
        Number(e.valor) === Number(r.valor) &&
        String(e.vencimento) === String(r.vencimento)
      );
    return !!match;
  };

  const novos = rows.filter(r => !isDup(r));
  if (novos.length === 0) return;

  const { error } = await supabase.from("lancamentos").insert(novos);
  if (error) throw error;
}
