import { useEffect, useRef, useState } from "react";
import { parseStuudiumHtml } from "./stuudiumParser";

/* =====================================================================
   Andmete toomine Stuudiumist ilma failita.

   1) JÄRJEHOIDJA (töötab telefonis ja arvutis):
      Kasutaja vajutab Stuudiumi lehel järjehoidjat "Koolipäevik". See võtab lehe
      sisu, pakib selle kokku ja avab Koolipäeviku aadressiga
      .../#stuudium=<andmed>. Osa pärast # ei lähe kunagi ühegi serverini.

   2) BRAUSERILAIENDUS (valikuline, arvutis): saadab lehe postMessage'iga.
   ===================================================================== */

const HASH_KEY = "stuudium";

// Järjehoidja kood. Sihtaadress on see sama leht, kus kasutaja järjehoidja paigaldab.
export function bookmarkletCode(appUrl) {
  const js = `(async()=>{try{if(!document.querySelector('.daily-summaries-segment')){alert('Ava Stuudiumi avaleht, kus on näha sinu tunnid, ja vajuta siis uuesti Koolipäevik.');return}const c=document.documentElement.cloneNode(true);c.querySelectorAll('script,style,svg,link,img,noscript,iframe').forEach(e=>e.remove());const s=new Blob([c.outerHTML]).stream().pipeThrough(new CompressionStream('gzip'));const b=new Uint8Array(await new Response(s).arrayBuffer());let t='';for(let i=0;i<b.length;i+=8192)t+=String.fromCharCode.apply(null,b.subarray(i,i+8192));location.href=${JSON.stringify(appUrl)}+'#${HASH_KEY}='+encodeURIComponent(btoa(t))+'&o='+encodeURIComponent(location.origin)+'&t='+Date.now()}catch(e){alert('Koolipäevik: '+e.message)}})()`;
  return "javascript:" + encodeURI(js).replace(/#/g, "%23");
}

async function decodeHashPayload(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

function readHash() {
  const h = window.location.hash;
  if (!h.startsWith(`#${HASH_KEY}=`)) return null;
  const params = new URLSearchParams(h.slice(1));
  // Eemaldame andmed aadressiribalt kohe (ei jää ajalukku ega jagatavasse linki).
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return { data: params.get(HASH_KEY), savedAt: Number(params.get("t")) || Date.now(), origin: params.get("o") || "" };
}

export function useExtensionSnapshot() {
  const [installed, setInstalled] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const lastSavedAt = useRef(null);

  function accept(html, savedAt, origin = "") {
    const key = String(savedAt);
    if (key === lastSavedAt.current) return;
    lastSavedAt.current = key;
    // Järjehoidja eemaldas lehelt pildid ja skriptid; lingi päritolu anname kaasa.
    const withOrigin = origin ? `<!-- ${origin} -->` + html : html;
    const diary = parseStuudiumHtml(withOrigin, { savedAt: new Date(savedAt) });
    if (diary.lessons.length) setSnapshot(diary);
    else setError("Stuudiumi lehelt ei leitud ühtegi tundi.");
  }

  useEffect(() => {
    // 1) Järjehoidja
    const incoming = readHash();
    if (incoming?.data) {
      decodeHashPayload(incoming.data)
        .then((html) => accept(html, incoming.savedAt, incoming.origin))
        .catch(() => setError("Stuudiumi andmeid ei õnnestunud lugeda. Proovi uuesti."));
    }

    // 2) Laiendus
    function onMessage(e) {
      if (e.source !== window || e.data?.source !== "koolipaevik-ext" || e.data.type !== "snapshot") return;
      setInstalled(true);
      const s = e.data.snapshot;
      if (s?.html) accept(s.html, Date.parse(s.savedAt), s.origin);
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ source: "koolipaevik-app", type: "request" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { installed, snapshot, error };
}

// Uued tunnid asendavad samad vanad; vanemad tunnid, mida Stuudium enam ei näita, jäävad alles.
export function mergeDiary(oldDiary, newDiary) {
  if (!oldDiary?.lessons?.length) return newDiary;
  const newIds = new Set(newDiary.lessons.map((l) => l.id));
  const oldest = newDiary.lessons.reduce((min, l) => (l.date < min ? l.date : min), "9999");
  const kept = oldDiary.lessons.filter((l) => !newIds.has(l.id) && l.date < oldest);
  return {
    ...newDiary,
    messages: newDiary.messages?.length ? newDiary.messages : oldDiary.messages || [],
    upcoming: newDiary.upcoming || oldDiary.upcoming || [],
    absenceSummary: newDiary.absenceSummary || oldDiary.absenceSummary || null,
    lessons: [...newDiary.lessons, ...kept].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

export const isNewer = (diary, current) => !current?.generatedAt || Date.parse(diary.generatedAt) > Date.parse(current.generatedAt);
