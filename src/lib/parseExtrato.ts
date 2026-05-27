import * as XLSX from "xlsx";

export type LinhaExtrato = {
  idx: number;
  data: string | null;
  descricao: string | null;
  credito: number | null;
  debito: number | null;
  tipo: "ENTRADA" | "SAIDA" | null;
  valor: number | null;
  valido: boolean;
  erro?: string;
};

export function normalizarValor(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return v;
  let s = String(v).trim();
  if (!s || s === "0" || s === "0,00") return null;
  // Remove sinal negativo no início para tratar depois
  const negativo = s.startsWith("-");
  if (negativo) s = s.slice(1).trim();
  // Remove símbolos de moeda e espaços
  s = s.replace(/r\$/i, "").replace(/\s+/g, "");
  let n: number;
  if (s.includes(",")) {
    // Formato BR: vírgula é decimal, pontos são separadores de milhar
    n = Number(s.replace(/\./g, "").replace(",", "."));
  } else if (s.includes(".")) {
    // Sem vírgula: descobrir se ponto é decimal ou milhar
    const parts = s.split(".");
    const ultima = parts[parts.length - 1];
    // 1 ponto único com 1-2 dígitos no fim → decimal (ex: 657.00, 1234.5)
    // Múltiplos pontos OU última parte com 3 dígitos → milhar (ex: 1.234, 1.234.567)
    if (parts.length === 2 && ultima.length <= 2) {
      n = Number(s);
    } else {
      n = Number(s.replace(/\./g, ""));
    }
  } else {
    n = Number(s);
  }
  if (!isFinite(n) || isNaN(n)) return null;
  return negativo ? -n : n;
}

export function normalizarDataPT(s: unknown): string | null {
  if (!s) return null;
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const mkYmd = (ano: number, mes: number, dia: number) => {
    if (!Number.isFinite(ano) || !Number.isFinite(mes) || !Number.isFinite(dia)) return null;
    if (ano < 1900 || ano > 2100) return null;
    if (mes < 1 || mes > 12) return null;
    if (dia < 1 || dia > 31) return null;
    return `${ano}-${pad2(mes)}-${pad2(dia)}`;
  };
  if (s instanceof Date) {
    const d = s as Date;
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().slice(0, 10);
  }
  const txt = String(s).trim();
  const isoWithOptionalTime = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (isoWithOptionalTime) {
    return mkYmd(Number(isoWithOptionalTime[1]), Number(isoWithOptionalTime[2]), Number(isoWithOptionalTime[3]));
  }
  const brWithOptionalTime = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/);
  if (brWithOptionalTime) {
    return mkYmd(Number(brWithOptionalTime[3]), Number(brWithOptionalTime[2]), Number(brWithOptionalTime[1]));
  }
  const brShortYear = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})(?:\s.*)?$/);
  if (brShortYear) {
    const yy = Number(brShortYear[3]);
    const ano = yy >= 70 ? 1900 + yy : 2000 + yy;
    return mkYmd(ano, Number(brShortYear[2]), Number(brShortYear[1]));
  }
  const dashDMY = txt.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s.*)?$/);
  if (dashDMY) {
    return mkYmd(Number(dashDMY[3]), Number(dashDMY[2]), Number(dashDMY[1]));
  }
  const slashYMD = txt.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})(?:\s.*)?$/);
  if (slashYMD) {
    return mkYmd(Number(slashYMD[1]), Number(slashYMD[2]), Number(slashYMD[3]));
  }
  const m = txt.match(/(\d{1,2})\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i);
  if (m) {
    const dia = Number(m[1]);
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const nome = m[2].toLowerCase();
    const mes = meses.indexOf(nome);
    const ano = Number(m[3]);
    if (mes >= 0) {
      return new Date(Date.UTC(ano, mes, dia)).toISOString().slice(0, 10);
    }
  }
  const maybeNum = Number(txt);
  if (!isNaN(maybeNum) && maybeNum > 30000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + maybeNum * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export type ParseResult =
  | { ok: true; linhas: LinhaExtrato[] }
  | { ok: false; erro: string };

// Parser CSV manual: preserva strings exatamente como estão (XLSX auto-converte
// "343,71" para 34371 e "01/12/2025" para data US, daí precisamos do nosso próprio).
function parseCsvText(text: string): string[][] {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const sep = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 2;
      } else if (c === '"') {
        inQuotes = false;
        i++;
      } else {
        cell += c;
        i++;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
        i++;
      } else if (c === sep) {
        row.push(cell);
        cell = "";
        i++;
      } else if (c === "\r") {
        if (text[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        i++;
      } else if (c === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        i++;
      } else {
        cell += c;
        i++;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export async function parseExtratoFile(file: File): Promise<ParseResult> {
  let rows: unknown[][] = [];
  try {
    const isCsv = file.name.toLowerCase().endsWith(".csv") || (file.type || "").toLowerCase().includes("csv");
    if (isCsv) {
      const text = (await file.text()).replace(/^﻿/, "");
      rows = parseCsvText(text) as unknown[][];
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as unknown as unknown[][];
    }
  } catch {
    return { ok: false, erro: "Não foi possível ler o arquivo. Envie um .xlsx ou .csv válido." };
  }

  let headerRowIdx = -1;
  let formatType: "padrao" | "cora" = "padrao";

  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i].map((x: unknown) =>
      String(x ?? "")
        .replace(/^﻿/, "")
        .trim()
        .toLowerCase()
    );
    if (r.some((c: string) => c.includes("data")) && r.some((c: string) => c.includes("descri"))) {
      if (r.some((c: string) => c.includes("crédito")) || r.some((c: string) => c.includes("credito"))) {
        headerRowIdx = i;
        formatType = "padrao";
        break;
      }
    }
    if (
      r.some((c: string) => c === "data") &&
      r.some((c: string) => c === "transação" || c === "transacao") &&
      r.some((c: string) => c.includes("tipo")) &&
      r.some((c: string) => c === "valor")
    ) {
      headerRowIdx = i;
      formatType = "cora";
      break;
    }
  }

  if (headerRowIdx < 0) {
    return {
      ok: false,
      erro: "Cabeçalho não encontrado. Verifique se a planilha tem colunas Data, Descrição, Crédito, Débito (formato padrão) ou Data, Transação, Tipo Transação, Valor (formato Cora).",
    };
  }

  const header = rows[headerRowIdx].map((x: unknown) => String(x ?? "").replace(/^﻿/, "").trim());
  const parsed: LinhaExtrato[] = [];

  if (formatType === "cora") {
    const idxData = header.findIndex((h: string) => h.toLowerCase() === "data");
    const idxTransacao = header.findIndex((h: string) => h.toLowerCase() === "transação" || h.toLowerCase() === "transacao");
    const idxTipo = header.findIndex((h: string) => h.toLowerCase().includes("tipo"));
    const idxValor = header.findIndex((h: string) => h.toLowerCase() === "valor");

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const data = normalizarDataPT(r[idxData]);
      const descricao = r[idxTransacao] != null ? String(r[idxTransacao]).trim() : null;
      const tipoStr = r[idxTipo] != null ? String(r[idxTipo]).toUpperCase().trim() : "";
      const valorRaw = normalizarValor(r[idxValor]);

      let tipo: "ENTRADA" | "SAIDA" | null = null;
      let valor: number | null = null;
      let credito: number | null = null;
      let debito: number | null = null;

      if (tipoStr.includes("CRÉD") || tipoStr.includes("CRED")) {
        tipo = "ENTRADA";
        valor = valorRaw ? Math.abs(valorRaw) : null;
        credito = valor;
      } else if (tipoStr.includes("DÉB") || tipoStr.includes("DEB")) {
        tipo = "SAIDA";
        valor = valorRaw ? Math.abs(valorRaw) : null;
        debito = valor;
      }

      const valido = Boolean(data && descricao && valor && tipo);
      if (!data && !descricao && !valorRaw) continue;
      parsed.push({ idx: i, data, descricao, credito, debito, tipo, valor, valido, erro: valido ? undefined : "Linha incompleta" });
    }
  } else {
    const idxData = header.findIndex((h: string) => h.toLowerCase().includes("data"));
    const idxDesc = header.findIndex((h: string) => h.toLowerCase().includes("descri"));
    const idxCred = header.findIndex((h: string) => h.toLowerCase().includes("crédito") || h.toLowerCase().includes("credito"));
    const idxDeb = header.findIndex((h: string) => h.toLowerCase().includes("débito") || h.toLowerCase().includes("debito"));

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length === 0) continue;
      const data = normalizarDataPT(r[idxData]);
      const descricao = r[idxDesc] != null ? String(r[idxDesc]).trim() : null;
      const credito = normalizarValor(r[idxCred]);
      const debito = normalizarValor(r[idxDeb]);
      let tipo: "ENTRADA" | "SAIDA" | null = null;
      let valor: number | null = null;
      if (credito && !debito) { tipo = "ENTRADA"; valor = credito; }
      else if (debito && !credito) { tipo = "SAIDA"; valor = debito; }
      const valido = Boolean(data && descricao && valor && tipo);
      if (!data && !descricao && !credito && !debito) continue;
      parsed.push({ idx: i, data, descricao, credito, debito, tipo, valor, valido, erro: valido ? undefined : "Linha incompleta" });
    }
  }

  return { ok: true, linhas: parsed };
}
