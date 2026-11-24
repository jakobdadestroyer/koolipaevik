import { supabase } from "./supabase";

export const aiAvailable = () => Boolean(supabase);

const DIRECT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// Proovib pildi avada kahel viisil (mõni brauser ei oska createImageBitmap'iga kõike).
async function decodeImage(file) {
  try {
    const bmp = await createImageBitmap(file);
    return { source: bmp, width: bmp.width, height: bmp.height };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight };
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
}

// Vähendab pildi (tahvlifoto võib olla 10+ MB) enne saatmist.
async function imageToBase64(file, maxSide = 1600) {
  let decoded;
  try {
    decoded = await decodeImage(file);
  } catch {
    // Ei saanud avada: kui fail on juba sobivas vormingus ja väike, saadame selle otse.
    if (DIRECT_TYPES.includes(file.type) && file.size < 4_500_000) return { data: await readAsBase64(file), mediaType: file.type };
    throw new Error("Seda pilti ei õnnestunud avada (tõenäoliselt iPhone'i HEIC-formaat). Tee pildist ekraanipilt või salvesta see JPG-na ja proovi uuesti.");
  }
  const scale = Math.min(1, maxSide / Math.max(decoded.width, decoded.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(decoded.width * scale));
  canvas.height = Math.max(1, Math.round(decoded.height * scale));
  canvas.getContext("2d").drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { data: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}

// Kutsub serveris funktsiooni "konspekt". Tagastab Markdown-teksti.
export async function generateWithAI({ context, prompt, imageFile }) {
  if (!supabase) throw new Error("AI töötab ainult sisselogituna veebilehel.");
  const image = imageFile ? await imageToBase64(imageFile) : undefined;
  const { data, error } = await supabase.functions.invoke("konspekt", { body: { context, prompt, image } });
  if (error) {
    let message = "AI-konspekti koostamine ebaõnnestus.";
    try {
      if (error.context?.status === 404) throw new Error("AI pole veel seadistatud. Proovi hiljem uuesti.");
      const body = await error.context?.json?.();
      if (body?.error) message = body.error;
    } catch (e) {
      if (e?.message?.startsWith("AI pole")) message = e.message;
    }
    throw new Error(message);
  }
  return data.text;
}

// Tunni info AI jaoks: see tund + sama aine viimased teemad.
export function lessonContext(lesson, lessons) {
  const recent = lessons
    .filter((l) => l.subject === lesson.subject && l.date <= lesson.date && l.id !== lesson.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  return [
    `Aine: ${lesson.subject}`,
    `Kuupäev: ${lesson.date}`,
    `Tunni teema: ${lesson.topic}`,
    lesson.details ? `Kirjeldus ja kodutöö:\n${lesson.details}` : "",
    lesson.links?.length ? `Materjalid: ${lesson.links.map((l) => l.label).join(", ")}` : "",
    recent.length ? `Sama aine eelmised tunnid:\n${recent.map((l) => `- ${l.date}: ${l.topic}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const PROMPT_IDEAS = [
  "Tee 10 kontrollküsimust koos vastustega",
  "Selgita lihtsalt, nagu 7. klassi õpilasele",
  "Tee mõistete sõnastik",
  "Lahenda 3 näidisülesannet samm-sammult",
  "Tee lühike ühe lehekülje spikker",
];
