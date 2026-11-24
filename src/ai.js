import { supabase } from "./supabase";

export const aiAvailable = () => Boolean(supabase);

// Vähendab pildi (tahvlifoto võib olla 10+ MB) enne saatmist.
async function imageToBase64(file, maxSide = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
