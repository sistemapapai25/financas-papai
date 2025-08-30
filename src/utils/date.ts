// src/utils/date.ts

/**
 * Retorna a data atual no fuso local em formato YYYY-MM-DD
 */
export function todayYMD(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  
  /**
   * Converte "YYYY-MM-DD" -> "DD/MM/YYYY"
   */
  export function ymdToBr(ymd: string): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || "-";
    const [y, m, d] = ymd.split("-");
    return `${d}/${m}/${y}`;
  }
  
  /**
   * Converte "DD/MM/YYYY" -> "YYYY-MM-DD"
   */
  export function brToYmd(br: string): string {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(br)) return br;
    const [d, m, y] = br.split("/");
    return `${y}-${m}-${d}`;
  }
  
  /**
   * Adiciona ou remove dias de uma data YYYY-MM-DD
   */
  export function addDays(ymd: string, days: number): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }
  