import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
declare const Deno: { env: { get(name: string): string | undefined }; serve: (handler: (req: Request) => Response | Promise<Response>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }
    const { url, file_url, user_id, descricao } = await req.json();
    const srcUrl: string | undefined = (typeof file_url === "string" && file_url) || (typeof url === "string" && url) || undefined;
    if (!srcUrl || !user_id) {
      return new Response(
        JSON.stringify({ success: false, error: "missing url/file_url or user_id" }),
        { status: 400, headers: { "content-type": "application/json", ...corsHeaders } }
      );
    }

    let text = "";
    try {
      const res = await fetch(srcUrl);
      const ct = res.headers.get("content-type") || "";
      if (ct.startsWith("text/")) {
        text = await res.text();
      } else {
        try {
          const buf = await res.arrayBuffer();
          const raw = new TextDecoder("latin1").decode(buf);
          text = raw || srcUrl.toLowerCase();
          if (!text || text.length < 20) {
            const u8 = new Uint8Array(buf);
            const inflate = async (bytes: Uint8Array): Promise<string | null> => {
              try {
                const rs = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
                const ds = new DecompressionStream("deflate");
                const out = rs.pipeThrough(ds);
                const ab = await new Response(out).arrayBuffer();
                return new TextDecoder("utf-8").decode(new Uint8Array(ab));
              } catch {
                return null;
              }
            };
            const findIdx = (src: Uint8Array, pat: Uint8Array, from: number) => {
              outer: for (let i = from; i <= src.length - pat.length; i++) {
                for (let j = 0; j < pat.length; j++) {
                  if (src[i + j] !== pat[j]) continue outer;
                }
                return i;
              }
              return -1;
            };
            const aStream = new TextEncoder().encode("stream");
            const aEnd = new TextEncoder().encode("endstream");
            let pos = 0;
            let extracted = "";
            while (true) {
              const sIdx = findIdx(u8, aStream, pos);
              if (sIdx < 0) break;
              const eIdx = findIdx(u8, aEnd, sIdx + aStream.length);
              if (eIdx < 0) break;
              const start = sIdx + aStream.length;
              const end = eIdx;
              const slice = u8.subarray(start, end);
              const t = await inflate(slice);
              if (t && t.length > 0) extracted += "\n" + t;
              pos = eIdx + aEnd.length;
            }
            if (extracted) text = extracted;
          }
        } catch {
          text = srcUrl.toLowerCase();
        }
      }
    } catch {
      text = srcUrl.toLowerCase();
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: rules } = await supabase
      .from("classification_rules")
      .select("term,category_id,beneficiary_id")
      .eq("user_id", user_id);

    const { data: bens } = await supabase
      .from("beneficiaries")
      .select("id,name")
      .eq("user_id", user_id);

    let sugestao: { categoria_id?: string | null; beneficiario_id?: string | null; motivo?: string } | null = null;
    const base = (text || "").toLowerCase();
    const desc = (typeof descricao === "string" ? descricao : "").toLowerCase();
    const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const norm = strip(`${base} ${desc}`).toLowerCase();
    if (rules && norm) {
      type Rule = { term: string | null; category_id?: string | null; beneficiary_id?: string | null };
      const rs: Rule[] = Array.isArray(rules) ? (rules as Rule[]) : [];
      for (const r of rs) {
        const term = strip(String(r.term || "")).toLowerCase();
        if (!term) continue;
        if (norm.includes(term)) {
          sugestao = {
            categoria_id: r.category_id || null,
            beneficiario_id: r.beneficiary_id || null,
            motivo: `Termo encontrado: ${r.term}`,
          };
          break;
        }
      }
    }

    let recebedor_nome: string | undefined;
    let recebedor_id: string | undefined;
    if (!recebedor_nome && text) {
      const plain = String(text);
      const lines = plain.replace(/\r/g, "").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        if (/^para\b/i.test(l)) {
          const name = l.replace(/^para\s*/i, "").trim();
          if (name && name.length > 2) {
            recebedor_nome = name;
            break;
          }
        }
      }
      if (!recebedor_nome) {
        const m = plain.match(/dados do recebedor[\s\S]*?para\s+(.+?)(?:\n|$)/i);
        if (m && m[1]) {
          const name = m[1].trim();
          if (name && name.length > 2) recebedor_nome = name;
        }
      }
    }
    if (bens && bens.length > 0 && norm) {
      const candidates = (bens as { id: string; name: string }[]).map(b => ({ id: b.id, n: strip(b.name).toLowerCase() }));
      let best: { id: string; n: string } | undefined;
      for (const c of candidates) {
        if (!c.n) continue;
        if (norm.includes(c.n)) {
          if (!best || c.n.length > best.n.length) best = c;
        }
      }
      if (best) {
        recebedor_id = best.id;
        const full = (bens as { id: string; name: string }[]).find(b => b.id === best.id)?.name;
        recebedor_nome = full || undefined;
      }
    }

    return new Response(JSON.stringify({ success: true, sugestao, recebedor_nome, beneficiario_id: recebedor_id ?? sugestao?.beneficiario_id ?? null }), { headers: { "content-type": "application/json", ...corsHeaders } });
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }
});
