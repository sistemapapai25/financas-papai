import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
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

    console.log("Analyzing comprovante:", srcUrl.substring(0, 100));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Fetch beneficiaries for matching
    const { data: bens } = await supabase
      .from("beneficiaries")
      .select("id,name")
      .eq("user_id", user_id);

    const { data: cats } = await supabase
      .from("categories")
      .select("id,name")
      .eq("user_id", user_id);

    // Try to use AI vision to analyze the comprovante
    let aiResult: { recebedor_nome?: string; valor?: string; data?: string } | null = null;
    
    if (lovableApiKey) {
      try {
        // Fetch the image/PDF and convert to base64
        const fileResponse = await fetch(srcUrl);
        if (fileResponse.ok) {
          const contentType = fileResponse.headers.get("content-type") || "";
          const arrayBuffer = await fileResponse.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          
          // Determine the media type for the AI
          let mediaType = "image/png";
          if (contentType.includes("pdf")) {
            mediaType = "application/pdf";
          } else if (contentType.includes("jpeg") || contentType.includes("jpg")) {
            mediaType = "image/jpeg";
          } else if (contentType.includes("png")) {
            mediaType = "image/png";
          } else if (contentType.includes("webp")) {
            mediaType = "image/webp";
          }

          console.log("Calling AI vision with content type:", mediaType);

          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${lovableApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                {
                  role: "system",
                  content: `Você é um assistente especializado em analisar comprovantes de pagamento brasileiros (PIX, transferências, boletos).
Extraia as seguintes informações do comprovante:
- Nome do recebedor/favorecido (quem recebeu o pagamento)
- Valor do pagamento
- Data do pagamento

Responda APENAS em JSON no formato:
{"recebedor_nome": "Nome da Pessoa ou Empresa", "valor": "R$ 100,00", "data": "01/01/2025"}

Se não conseguir identificar alguma informação, use null para esse campo.
Se não for um comprovante de pagamento válido, responda: {"error": "Não é um comprovante válido"}`
                },
                {
                  role: "user",
                  content: [
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mediaType};base64,${base64}`
                      }
                    },
                    {
                      type: "text",
                      text: "Analise este comprovante de pagamento e extraia as informações do recebedor, valor e data."
                    }
                  ]
                }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            console.log("AI response:", content);
            
            // Parse JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                aiResult = JSON.parse(jsonMatch[0]);
                console.log("Parsed AI result:", aiResult);
              } catch (parseErr) {
                console.error("Failed to parse AI JSON:", parseErr);
              }
            }
          } else {
            const errorText = await aiResponse.text();
            console.error("AI API error:", aiResponse.status, errorText);
          }
        }
      } catch (aiErr) {
        console.error("AI analysis error:", aiErr);
      }
    } else {
      console.log("LOVABLE_API_KEY not configured, skipping AI analysis");
    }

    // Match beneficiary if we found a name
    let recebedor_id: string | undefined;
    let recebedor_nome = aiResult?.recebedor_nome;

    if (recebedor_nome && bens && bens.length > 0) {
      const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const normRecebedor = strip(recebedor_nome);
      
      const candidates = (bens as { id: string; name: string }[]).map(b => ({ 
        id: b.id, 
        name: b.name,
        n: strip(b.name) 
      }));
      
      let best: { id: string; name: string; n: string } | undefined;
      for (const c of candidates) {
        if (!c.n) continue;
        // Check if beneficiary name is contained in receiver name or vice versa
        if (normRecebedor.includes(c.n) || c.n.includes(normRecebedor)) {
          if (!best || c.n.length > best.n.length) best = c;
        }
      }
      
      if (best) {
        recebedor_id = best.id;
        recebedor_nome = best.name;
        console.log("Matched beneficiary:", best.name);
      }
    }

    // Get classification rules suggestion
    let sugestao: { categoria_id?: string | null; beneficiario_id?: string | null; motivo?: string } | null = null;
    
    const { data: rules } = await supabase
      .from("classification_rules")
      .select("term,category_id,beneficiary_id,aplica_todos,category_name,beneficiary_name")
      .or(`user_id.eq.${user_id},aplica_todos.eq.true`)
      .order("created_at", { ascending: false });

    const desc = (typeof descricao === "string" ? descricao : "").toLowerCase();
    const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const norm = strip(`${recebedor_nome || ""} ${desc}`).toLowerCase();
    
    if (rules && norm) {
      type Rule = {
        term: string | null;
        category_id?: string | null;
        beneficiary_id?: string | null;
        aplica_todos?: boolean | null;
        category_name?: string | null;
        beneficiary_name?: string | null;
      };
      const rs: Rule[] = Array.isArray(rules) ? (rules as Rule[]) : [];
      const orderedRules = [
        ...rs.filter((r) => !r.aplica_todos),
        ...rs.filter((r) => r.aplica_todos),
      ];
      for (const r of orderedRules) {
        const term = strip(String(r.term || "")).toLowerCase();
        if (!term) continue;
        if (norm.includes(term)) {
          let categoria_id = r.category_id || null;
          let beneficiario_id = r.beneficiary_id || null;

          if (r.aplica_todos) {
            categoria_id = null;
            beneficiario_id = null;

            if (r.category_name) {
              const categoryName = strip(r.category_name).toLowerCase();
              categoria_id = ((cats || []) as { id: string; name: string }[])
                .find((c) => strip(c.name).toLowerCase() === categoryName)?.id ?? r.category_id ?? null;
              if (!categoria_id) continue;
            }

            if (r.beneficiary_name) {
              const beneficiaryName = strip(r.beneficiary_name).toLowerCase();
              beneficiario_id = ((bens || []) as { id: string; name: string }[])
                .find((b) => strip(b.name).toLowerCase() === beneficiaryName)?.id ?? r.beneficiary_id ?? null;
              if (!beneficiario_id) continue;
            }
          }

          sugestao = {
            categoria_id,
            beneficiario_id,
            motivo: `Termo encontrado: ${r.term}`,
          };
          break;
        }
      }
    }

    const result = {
      success: true,
      sugestao,
      recebedor_nome: recebedor_nome || null,
      beneficiario_id: recebedor_id ?? sugestao?.beneficiario_id ?? null,
      valor: aiResult?.valor || null,
      data: aiResult?.data || null,
    };

    console.log("Final result:", result);

    return new Response(JSON.stringify(result), { 
      headers: { "content-type": "application/json", ...corsHeaders } 
    });
  } catch (e) {
    console.error("Error in analisar-comprovante:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { "content-type": "application/json", ...corsHeaders } }
    );
  }
});
