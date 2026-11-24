import React, { useState, useRef, useEffect } from "react";
import { BookOpen, Loader2, Upload, X, CheckCircle2, Bookmark, ClipboardCopy } from "lucide-react";
import { supabase } from "./supabase";
import { parseStuudiumHtml } from "./stuudiumParser";
import { bookmarkletCode } from "./extensionBridge";

const DISPLAY = "font-['Bricolage_Grotesque',system-ui,sans-serif]";

/* =====================================================================
   Sisselogimine / registreerumine
   ===================================================================== */

const AUTH_ERRORS = {
  "Invalid login credentials": "Vale e-post või parool.",
  "Email not confirmed": "Kinnita esmalt oma e-post: vaata postkasti ja vajuta kirjas olevat linki.",
  "User already registered": "Selle e-postiga konto on juba olemas. Logi sisse.",
};

export function AuthScreen({ onDemo }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const redirect = window.location.origin + window.location.pathname;
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
        if (error) throw error;
        if (!data.session) setInfo("Konto on loodud. Saatsime sulle e-kirja: vajuta selles olevat linki ja logi siis sisse.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirect });
        if (error) throw error;
        setInfo("Kui selle e-postiga konto on olemas, saatsime sinna parooli vahetamise lingi.");
      }
    } catch (err) {
      setError(AUTH_ERRORS[err.message] || err.message || "Midagi läks valesti. Proovi uuesti.");
    } finally {
      setBusy(false);
    }
  }

  const titles = { login: "Logi sisse", signup: "Loo konto", reset: "Parooli taastamine" };

  return (
    <div className="flex min-h-full items-center justify-center bg-[#FDFBF7] px-4 py-10 font-['Figtree',system-ui,sans-serif] text-stone-900">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E3F1E4]">
            <BookOpen size={26} className="text-[#3E7A47]" aria-hidden="true" />
          </div>
          <h1 className={`${DISPLAY} text-3xl font-bold tracking-tight`}>Koolipäevik</h1>
          <p className="text-[14px] text-stone-500">Sinu Stuudiumi tunnid, hinded ja konspektid ühes kohas.</p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-3xl border border-stone-200 bg-white p-5">
          <h2 className={`${DISPLAY} text-lg font-semibold`}>{titles[mode]}</h2>
          <label className="block space-y-1">
            <span className="text-[13px] font-semibold text-stone-600">E-post</span>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-[#FDFBF7] px-3 py-2.5 text-[15px] outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-800/10"
            />
          </label>
          {mode !== "reset" && (
            <label className="block space-y-1">
              <span className="text-[13px] font-semibold text-stone-600">Parool</span>
              <input
                id="auth-password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-[#FDFBF7] px-3 py-2.5 text-[15px] outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-800/10"
              />
              {mode === "signup" && <span className="text-[12px] text-stone-400">Vähemalt 8 märki. Ära kasuta oma Stuudiumi parooli.</span>}
            </label>
          )}

          {error && <p role="alert" className="rounded-xl bg-[#FBE6EC] px-3 py-2 text-[13px] font-medium text-rose-800">{error}</p>}
          {info && <p role="status" className="rounded-xl bg-[#E3F1E4] px-3 py-2 text-[13px] font-medium text-emerald-800">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-[15px] font-semibold text-[#FDFBF7] hover:bg-stone-800 disabled:opacity-70"
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {mode === "login" ? "Logi sisse" : mode === "signup" ? "Loo konto" : "Saada link"}
          </button>

          <div className="flex flex-wrap justify-between gap-2 pt-1 text-[13px] font-semibold">
            {mode === "login" ? (
              <>
                <button type="button" onClick={() => setMode("signup")} className="text-stone-700 hover:text-stone-900">Loo uus konto</button>
                <button type="button" onClick={() => setMode("reset")} className="text-stone-500 hover:text-stone-800">Unustasid parooli?</button>
              </>
            ) : (
              <button type="button" onClick={() => setMode("login")} className="text-stone-700 hover:text-stone-900">← Mul on konto, logi sisse</button>
            )}
          </div>
        </form>

        <button type="button" onClick={onDemo} className="w-full text-center text-[14px] font-semibold text-stone-500 hover:text-stone-800">
          Vaata enne näidisandmetega →
        </button>
      </div>
    </div>
  );
}

/* Uue parooli määramine (kui kasutaja tuli parooli taastamise lingiga) */
export function NewPasswordScreen({ onDone }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else onDone();
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-[#FDFBF7] px-4 py-10 font-['Figtree',system-ui,sans-serif]">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-3xl border border-stone-200 bg-white p-5">
        <h2 className={`${DISPLAY} text-lg font-semibold`}>Määra uus parool</h2>
        <input
          id="new-password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-stone-300 bg-[#FDFBF7] px-3 py-2.5 text-[15px] outline-none focus:border-stone-500"
        />
        {error && <p role="alert" className="text-[13px] text-rose-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-stone-900 px-4 py-2.5 font-semibold text-[#FDFBF7] disabled:opacity-70">
          Salvesta parool
        </button>
      </form>
    </div>
  );
}

/* =====================================================================
   Stuudiumi päeviku üleslaadimine
   ===================================================================== */

const DEVICES = {
  iphone: {
    label: "iPhone",
    steps: [
      "Vajuta all nuppu „Kopeeri kood”.",
      "Ava Safaris ükskõik milline leht, vajuta Jaga-nuppu (□↑) → „Lisa järjehoidja” → nimeks Koolipäevik → Salvesta.",
      "Ava järjehoidjad (📖) → Muuda → vali Koolipäevik → kustuta aadress ja kleebi kood asemele → Valmis.",
      "Ava Safaris Stuudium, logi sisse ja vajuta järjehoidjates Koolipäevik.",
    ],
  },
  android: {
    label: "Android",
    steps: [
      "Vajuta all nuppu „Kopeeri kood”.",
      "Chrome'is vajuta ⋮ → ☆ (lisa järjehoidja), siis „Muuda”: nimeks Koolipäevik ja aadressiks kleebi kood.",
      "Ava Chrome'is Stuudium ja logi sisse.",
      "Kirjuta aadressiribale Koolipäevik ja vali nimekirjast järjehoidja (tähe-ikooniga).",
    ],
  },
  computer: {
    label: "Arvuti",
    steps: [
      "Näita järjehoidjate riba: Cmd + Shift + B (Windowsis Ctrl + Shift + B).",
      "Lohista all olev nupp „Koolipäevik” järjehoidjate ribale.",
      "Ava Stuudium, logi sisse ja vajuta ribal Koolipäevik.",
    ],
  },
};

function guessDevice() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "iphone";
  if (/Android/i.test(ua)) return "android";
  return "computer";
}

function BookmarkletSection() {
  const [device, setDevice] = useState(guessDevice);
  const [copied, setCopied] = useState("");
  const linkRef = useRef(null);
  const code = bookmarkletCode(window.location.origin + window.location.pathname);

  // React ei luba javascript:-linke otse renderdada, seega paneme aadressi käsitsi.
  useEffect(() => {
    linkRef.current?.setAttribute("href", code);
  }, [code, device]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("Kood kopeeritud");
    } catch {
      setCopied("Kopeerimine ebaõnnestus. Vali kood allolevast kastist käsitsi.");
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-4">
      <p className="flex items-center gap-2 text-[14px] font-bold text-stone-900">
        <Bookmark size={16} aria-hidden="true" />
        Järjehoidja „Koolipäevik” (soovitatud)
      </p>
      <p className="mt-1 text-[13px] text-stone-600">
        Seadista üks kord. Edaspidi ava Stuudium, vajuta järjehoidjat ja päevik uueneb. Töötab telefonis ja arvutis.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-stone-100 p-1" role="tablist" aria-label="Seade">
        {Object.entries(DEVICES).map(([key, d]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={device === key}
            onClick={() => setDevice(key)}
            className={`rounded-lg py-1.5 text-[13px] font-semibold ${device === key ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <ol className="mt-3 space-y-2 text-[13px] text-stone-700">
        {DEVICES[device].steps.map((t, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E3F1E4] text-[11px] font-bold tabular-nums text-[#3E7A47]">{i + 1}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>

      <div className="mt-3 flex flex-wrap gap-2">
        {device === "computer" ? (
          <a
            ref={linkRef}
            onClick={(e) => e.preventDefault()}
            className="inline-flex cursor-grab items-center gap-2 rounded-xl bg-[#E3F1E4] px-4 py-2.5 text-[14px] font-semibold text-[#24502b] ring-1 ring-[#C9E3CB]"
            title="Lohista see järjehoidjate ribale"
          >
            <Bookmark size={15} aria-hidden="true" />
            Koolipäevik
          </a>
        ) : null}
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-[14px] font-semibold text-[#FDFBF7] hover:bg-stone-800"
        >
          <ClipboardCopy size={15} aria-hidden="true" />
          Kopeeri kood
        </button>
      </div>
      {copied && <p role="status" className="mt-2 text-[13px] font-semibold text-emerald-700">{copied}</p>}
      <details className="mt-3">
        <summary className="cursor-pointer text-[12px] font-semibold text-stone-500">Näita koodi</summary>
        <textarea
          id="bookmarklet-code"
          readOnly
          value={code}
          onFocus={(e) => e.target.select()}
          className="mt-2 h-20 w-full rounded-lg border border-stone-200 bg-stone-50 p-2 font-mono text-[11px] text-stone-600"
        />
      </details>
    </div>
  );
}

export function ImportModal({ onClose, onImported, extensionInstalled = false }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setError("");
    setResult(null);
    if (!/\.html?$/i.test(file.name)) {
      setError("See pole HTML-fail. Salvesta Stuudiumi päeviku leht valikuga „Webpage, Complete” ja vali fail, mis lõpeb .html-iga.");
      return;
    }
    setBusy(true);
    try {
      const html = await file.text();
      const data = parseStuudiumHtml(html, { savedAt: new Date(file.lastModified || Date.now()) });
      if (!data.lessons.length) {
        throw new Error("Failist ei leitud ühtegi tundi. Kontrolli, et salvestasid Stuudiumi avalehe (päeviku), kus on näha päevade kaupa tunnid.");
      }
      await onImported(data);
      setResult(data);
    } catch (err) {
      setError(err.message || "Faili lugemine ebaõnnestus.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92%] w-full max-w-lg flex-col overflow-y-auto rounded-t-3xl bg-[#FDFBF7] p-5 shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="import-title" className={`${DISPLAY} text-xl font-bold`}>Uuenda Stuudiumist</h2>
          <button type="button" onClick={onClose} aria-label="Sulge" className="rounded-full p-2 text-stone-500 hover:bg-stone-100">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <BookmarkletSection />

        <h3 className="mt-5 text-[12px] font-bold uppercase tracking-[0.06em] text-stone-500">Või lae fail käsitsi</h3>
        <ol className="mt-2 space-y-2 text-[14px] text-stone-700">
          {[
            "Ava arvutis Stuudium ja logi sisse. Avaleht, kus on näha päevade kaupa tunnid, ongi päevik.",
            "Vajuta Cmd + S (Windowsis Ctrl + S) ja vali „Webpage, Complete”.",
            "Lohista salvestatud .html fail allolevasse kasti.",
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E3F1E4] text-[12px] font-bold tabular-nums text-[#3E7A47]">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`mt-4 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
            dragging ? "border-emerald-500 bg-[#E3F1E4]" : "border-stone-300 bg-white hover:border-stone-400"
          }`}
        >
          {busy ? <Loader2 size={28} className="animate-spin text-stone-400" aria-hidden="true" /> : <Upload size={28} className="text-stone-400" aria-hidden="true" />}
          <span className="text-[14px] font-semibold text-stone-700">{busy ? "Loen faili…" : "Lohista päeviku fail siia"}</span>
          <span className="text-[13px] text-stone-500">või vajuta, et valida fail</span>
          <input id="import-file" ref={inputRef} type="file" accept=".html,.htm,text/html" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl bg-[#FBE6EC] px-3 py-2 text-[13px] font-medium text-rose-800">{error}</p>}
        {result && (
          <div role="status" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#E3F1E4] px-3 py-2.5">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-emerald-800">
              <CheckCircle2 size={16} aria-hidden="true" />
              {result.lessons.length} tundi laaditud
            </span>
            <button type="button" onClick={onClose} className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-stone-800">
              Vaata päevikut
            </button>
          </div>
        )}
        <p className="mt-4 text-[12px] text-stone-400">Faili loeb sinu enda brauser. Salvestatakse ainult tunnid, teemad, hinded ja puudumised, mitte sinu Stuudiumi parool ega sessioon.</p>
      </div>
    </div>
  );
}
