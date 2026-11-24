// Supabase Edge Function "konspekt": koostab Claude'iga õppematerjali.
// Saladused (Edge Functions -> Secrets): ANTHROPIC_API_KEY. Valikuline: AI_DAILY_LIMIT (vaikimisi 20).
// SUPABASE_URL ja SUPABASE_SERVICE_ROLE_KEY lisab Supabase ise.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const SYSTEM = `Sa oled Eesti gümnaasiumiõpilase õpiabiline. Koostad konspekte ja kordamismaterjale eesti keeles.

Sulle antakse tunni või kontrolltöö info õpilase e-päevikust (teemad, kirjeldused, kodutööd) ning mõnikord pilt tahvlist või vihikust. Õpilane võib lisada oma soovi, mida materjal peaks sisaldama: järgi seda soovi esmajärjekorras.

Kirjuta Markdownis: pealkirjad (##), loetelud, **rasvane** oluliste mõistete jaoks. Ole täpne ja konkreetne. Kui e-päeviku info on napp, kasuta oma teadmisi teema kohta, aga ära leiuta õpetaja öeldut ega konkreetseid ülesandenumbreid. Kui pildil on tekst või valemid, too need konspekti sisse. Matemaatikas ja loodusainetes lisa lahendatud näide, kui see aitab.`;

const MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Ainult POST" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1) Kes küsib? (sisselogitud kasutaja)
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return json({ error: "Logi sisse, et AI-konspekti koostada." }, 401);

  // 2) Päevane piirang
  const limit = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "20");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= limit) return json({ error: `Päevane piirang (${limit} konspekti) on täis. Proovi homme uuesti.` }, 429);

  // 3) Sisend
  let body: { context?: string; prompt?: string; image?: { data: string; mediaType: string } };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Vigane päring." }, 400);
  }
  const context = String(body.context ?? "").slice(0, 20000);
  const prompt = String(body.prompt ?? "").slice(0, 2000);
  if (!context.trim()) return json({ error: "Tunni info puudub." }, 400);

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (body.image?.data) {
    if (!MEDIA_TYPES.has(body.image.mediaType) || body.image.data.length > 7_000_000) {
      return json({ error: "Pilt on liiga suur või vale vorminguga." }, 400);
    }
    content.push({ type: "image", source: { type: "base64", media_type: body.image.mediaType as "image/jpeg", data: body.image.data } });
  }
  content.push({
    type: "text",
    text: `<e_paevik>\n${context}\n</e_paevik>\n\n<opilase_soov>\n${prompt || "Koosta selge ja struktureeritud konspekt koos mõne kontrollküsimusega."}\n</opilase_soov>`,
  });

  // 4) Claude
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return json({ error: "AI keeldus selle päringu täitmisest. Proovi soovi teisiti sõnastada." }, 422);
    }
    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    await admin.from("ai_usage").insert({ user_id: user.id });
    return json({ text, truncated: response.stop_reason === "max_tokens" });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: "AI on hetkel ülekoormatud. Proovi minuti pärast uuesti." }, 503);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "Serveri AI-võti on vale või puudub." }, 500);
    if (err instanceof Anthropic.APIError) return json({ error: `AI viga (${err.status}). Proovi uuesti.` }, 502);
    return json({ error: "Ühendus AI-ga ebaõnnestus. Proovi uuesti." }, 502);
  }
});
