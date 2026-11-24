import React, { useState, useEffect, useMemo, useRef } from "react";
import { BookOpen, MessageSquare, Sparkles, ChevronDown, ChevronUp, FileText, ArrowLeft, X, ImagePlus, ExternalLink, CheckCircle2, Award, AlertCircle, Clock, ClipboardCopy, Loader2, CalendarDays, Megaphone, Info, BookMarked, Trash2, RefreshCw, LogIn, LogOut } from "lucide-react";
import { MOCK_DATA } from "./mockData";
import { supabase, loadUserData, saveDiary, saveNotes } from "./supabase";
import { AuthScreen, NewPasswordScreen, ImportModal } from "./Account";

/* =====================================================================
   Abifunktsioonid
   ===================================================================== */

const WEEKDAYS = ["Pühapäev", "Esmaspäev", "Teisipäev", "Kolmapäev", "Neljapäev", "Reede", "Laupäev"];
const MONTHS = ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];

// "2026-11-10" -> "Teisipäev, 10. november"
function formatDayHeading(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]}, ${d}. ${MONTHS[m - 1]}`;
}

// "2026-11-10" -> "10.11"
function formatShortDate(iso) {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

// Kui statusType puudub, tuletame selle staatuse tekstist.
function getStatusType(lesson) {
  if (lesson.statusType) return lesson.statusType;
  const s = (lesson.status || "").toLowerCase();
  if (s.includes("hinne") || /\d+\s*%/.test(s)) return "grade";
  if (s.includes("põhjendamata")) return "absent_unexcused";
  if (s.includes("puudu")) return "absent_excused";
  if (s.includes("hilin")) return "late";
  return "present";
}

const STATUS_STYLES = {
  present: { cls: "bg-white/70 text-emerald-800 ring-emerald-700/15", Icon: CheckCircle2 },
  grade: { cls: "bg-indigo-600 text-white ring-indigo-700/20", Icon: Award },
  absent_excused: { cls: "bg-white/70 text-amber-800 ring-amber-700/20", Icon: AlertCircle },
  absent_unexcused: { cls: "bg-rose-600 text-white ring-rose-700/20", Icon: AlertCircle },
  late: { cls: "bg-white/70 text-orange-800 ring-orange-700/20", Icon: Clock },
};

// Iga aine saab oma pastelse kaardivärvi. Tundmatu aine saab värvi nime järgi.
const CARD_PALETTE = [
  { card: "bg-[#E3F1E4] border-[#C9E3CB]", dot: "bg-[#5E9E66]" }, // roheline
  { card: "bg-[#E2EEF9] border-[#C7DDF2]", dot: "bg-[#4E86BF]" }, // sinine
  { card: "bg-[#FBE6EC] border-[#F3CDD8]", dot: "bg-[#C46A86]" }, // roosa
  { card: "bg-[#FBF1D3] border-[#F1E0A8]", dot: "bg-[#B8922B]" }, // kollane
];
const SUBJECT_COLORS = {
  "Lai matemaatika": 0,
  "Inglise keel": 1,
  "Hispaania keel B1": 2,
  "Liikumisõpetus": 3,
};
function subjectColor(subject) {
  if (subject in SUBJECT_COLORS) return CARD_PALETTE[SUBJECT_COLORS[subject]];
  let h = 0;
  for (const ch of subject) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return CARD_PALETTE[h % CARD_PALETTE.length];
}

/* =====================================================================
   Sõnumite sorteerimine
   Praegu märksõnade põhjal. Hiljem saab selle asendada päris AI-kutsega,
   mis tagastab sama kujuga väärtuse: "today" | "events" | "general".
   ===================================================================== */

const MESSAGE_CATEGORIES = {
  today: { label: "Mõjutab tänast tundi", Icon: AlertCircle, cls: "bg-[#FBE6EC] border-[#F3CDD8]", chip: "bg-rose-600 text-white" },
  events: { label: "Üritused", Icon: CalendarDays, cls: "bg-[#FBF1D3] border-[#F1E0A8]", chip: "bg-amber-500 text-white" },
  general: { label: "Üldinfo", Icon: Info, cls: "bg-[#E2EEF9] border-[#C7DDF2]", chip: "bg-sky-600 text-white" },
};

function classifyMessage(msg, todayIso) {
  if (msg.category && MESSAGE_CATEGORIES[msg.category]) return msg.category;
  const text = `${msg.title} ${msg.body}`.toLowerCase();
  if (msg.date === todayIso && /(asendus|tänane|täna|ära jääb|jääb ära|ruum|õues)/.test(text)) return "today";
  if (/(laat|teater|ekskursioon|üritus|kontsert|võistlus|pidu|külastus)/.test(text)) return "events";
  return "general";
}

/* =====================================================================
   Konspekti süntees
   NÄIDISREŽIIM: koostab struktuuri tunni teema ja kirjelduse põhjal.
   Päris AI jaoks asenda selle funktsiooni sisu kutsega oma serverisse,
   mis saadab pildi ja teema mudelile. Funktsiooni kuju jääb samaks.
   ===================================================================== */

async function synthesizeNotes({ lesson, imageFile }) {
  await new Promise((r) => setTimeout(r, 1400));
  const sentences = (lesson.details || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !/^kodus/i.test(s));
  const homework = (lesson.details || "").match(/Kodus:?\s*([^]*?)(?:$)/i)?.[1]?.trim();

  return {
    title: lesson.topic,
    subject: lesson.subject,
    date: lesson.date,
    source: imageFile ? `Tunni kirjeldus + pilt „${imageFile.name}”` : "Tunni kirjeldus",
    sections: [
      {
        heading: "Põhiidee",
        items: [sentences[0] || `Tunni teema oli „${lesson.topic}”.`],
      },
      {
        heading: "Mida tunnis tehti",
        items: sentences.slice(1).length ? sentences.slice(1) : ["Täpsem kirjeldus puudub. Lisa pilt tahvlist, et konspekt oleks põhjalikum."],
      },
      {
        heading: "Kontrolli ennast",
        items: [
          `Selgita oma sõnadega, mida tähendab „${lesson.topic}”.`,
          "Too üks näide, mida tunnis lahendati või arutati.",
          "Mis jäi selle teema juures kõige segasemaks?",
        ],
      },
      ...(homework ? [{ heading: "Kodutöö", items: [homework] }] : []),
    ],
  };
}

function notesToText(n) {
  return [`${n.subject} · ${formatDayHeading(n.date)}`, n.title, "", ...n.sections.flatMap((s) => [s.heading.toUpperCase(), ...s.items.map((i) => `• ${i}`), ""])].join("\n");
}

/* Brauseri mälu (spikri salvestamiseks). Kõik on try/catch'is, sest mõnes brauseris see puudub. */
const STORAGE_KEY = "koolipaevik.spikker.v1";
function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function persistSaved(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignoreeri */
  }
}

/* =====================================================================
   Komponendid
   ===================================================================== */

function StatusPill({ lesson }) {
  const { cls, Icon } = STATUS_STYLES[getStatusType(lesson)];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 whitespace-nowrap ${cls}`}>
      <Icon size={13} strokeWidth={2.5} aria-hidden="true" />
      {lesson.status}
    </span>
  );
}

function LessonCard({ lesson, onOpenSubject, onOpenNotes, showDate = false }) {
  const [open, setOpen] = useState(false);
  const color = subjectColor(lesson.subject);
  const hasMore = Boolean(lesson.details) || lesson.links?.length > 0;

  return (
    <article
      role={onOpenSubject ? "button" : undefined}
      tabIndex={onOpenSubject ? 0 : undefined}
      onClick={() => onOpenSubject?.(lesson.subject)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onOpenSubject?.(lesson.subject);
        }
      }}
      className={`rounded-2xl border p-4 transition active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40 ${onOpenSubject ? "cursor-pointer hover:shadow-[0_2px_12px_rgba(60,50,30,0.08)]" : ""} ${color.card}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-stone-600">
            <span className={`h-2 w-2 shrink-0 rounded-full ${color.dot}`} aria-hidden="true" />
            {showDate ? formatDayHeading(lesson.date) : lesson.subject}
          </div>
          <h3 className="mt-1 font-['Bricolage_Grotesque',system-ui,sans-serif] text-[17px] font-semibold leading-snug text-stone-900 [text-wrap:balance]">
            {lesson.topic}
          </h3>
        </div>
        <StatusPill lesson={lesson} />
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-stone-900/10 pt-3" onClick={(e) => e.stopPropagation()}>
          {lesson.details && <p className="whitespace-pre-line text-[14px] leading-relaxed text-stone-700">{lesson.details}</p>}
          {lesson.links?.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {lesson.links.map((l) => (
                <li key={l.url + l.label}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-[13px] font-medium text-stone-800 ring-1 ring-stone-900/10 hover:bg-white"
                  >
                    <ExternalLink size={13} aria-hidden="true" />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {hasMore ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 -ml-1.5 text-[13px] font-semibold text-stone-700 hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40"
          >
            {open ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
            {open ? "Peida kirjeldus" : "Kuva kirjeldus"}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenNotes(lesson);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[12px] font-semibold text-stone-700 ring-1 ring-stone-900/10 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40"
        >
          <FileText size={13} aria-hidden="true" />
          Konspekt
        </button>
      </div>
    </article>
  );
}

function DayDivider({ iso, isToday }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2 className="shrink-0 text-[13px] font-bold uppercase tracking-[0.06em] text-stone-500">
        {formatDayHeading(iso)}
        {isToday && <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] tracking-[0.08em] text-[#FDFBF7]">TÄNA</span>}
      </h2>
      <div className="h-px flex-1 bg-stone-300" />
    </div>
  );
}

function DiaryView({ lessons, todayIso, onOpenSubject, onOpenNotes, onImport }) {
  const days = useMemo(() => {
    const map = new Map();
    [...lessons]
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((l) => {
        if (!map.has(l.date)) map.set(l.date, []);
        map.get(l.date).push(l);
      });
    return [...map.entries()];
  }, [lessons]);

  if (!days.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center">
        <BookOpen size={28} className="text-stone-400" aria-hidden="true" />
        <h2 className="font-['Bricolage_Grotesque',system-ui,sans-serif] text-lg font-semibold text-stone-800">Päevik on veel tühi</h2>
        <p className="max-w-xs text-[14px] text-stone-500">Lae üles oma Stuudiumi päeviku leht, et siia ilmuksid sinu tunnid, hinded ja puudumised.</p>
        {onImport && (
          <button type="button" onClick={onImport} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-[14px] font-semibold text-[#FDFBF7] hover:bg-stone-800">
            <RefreshCw size={15} aria-hidden="true" />
            Lae Stuudiumist
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {days.map(([date, items]) => (
        <section key={date} className="space-y-3">
          <DayDivider iso={date} isToday={date === todayIso} />
          {items.map((l) => (
            <LessonCard key={l.id} lesson={l} onOpenSubject={onOpenSubject} onOpenNotes={onOpenNotes} />
          ))}
        </section>
      ))}
    </div>
  );
}

function SubjectHistory({ subject, lessons, onBack, onOpenNotes }) {
  const items = useMemo(() => lessons.filter((l) => l.subject === subject).sort((a, b) => a.date.localeCompare(b.date)), [lessons, subject]);
  const grades = items.filter((l) => getStatusType(l) === "grade");
  const absences = items.filter((l) => getStatusType(l).startsWith("absent"));
  const color = subjectColor(subject);

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold text-stone-800 ring-1 ring-stone-900/10 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Tagasi päevikusse
      </button>

      <header className={`rounded-2xl border p-5 ${color.card}`}>
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-stone-500">Aine ajalugu</p>
        <h2 className="mt-1 font-['Bricolage_Grotesque',system-ui,sans-serif] text-2xl font-bold text-stone-900">{subject}</h2>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["Tunde", items.length],
            ["Hindeid", grades.length],
            ["Puudumisi", absences.length],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/70 py-2">
              <dd className="text-xl font-bold tabular-nums text-stone-900">{v}</dd>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">{k}</dt>
            </div>
          ))}
        </dl>
      </header>

      <ol className="relative space-y-3 border-l-2 border-stone-200 pl-4">
        {items.map((l) => (
          <li key={l.id} className="relative">
            <span className={`absolute -left-[23px] top-5 h-3 w-3 rounded-full ring-4 ring-[#FDFBF7] ${color.dot}`} aria-hidden="true" />
            <LessonCard lesson={l} onOpenNotes={onOpenNotes} showDate />
          </li>
        ))}
      </ol>
    </div>
  );
}

function MessagesView({ messages, todayIso }) {
  const groups = useMemo(() => {
    const g = { today: [], events: [], general: [] };
    [...messages].sort((a, b) => b.date.localeCompare(a.date)).forEach((m) => g[classifyMessage(m, todayIso)].push(m));
    return g;
  }, [messages, todayIso]);

  if (!messages.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center">
        <MessageSquare size={28} className="text-stone-400" aria-hidden="true" />
        <h2 className="font-['Bricolage_Grotesque',system-ui,sans-serif] text-lg font-semibold text-stone-800">Sõnumeid veel pole</h2>
        <p className="max-w-xs text-[14px] text-stone-500">Stuudiumi sõnumite lugemine lisandub hiljem. Praegu tulevad siia ainult päeviku andmed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-[13px] text-stone-600 ring-1 ring-stone-900/5">
        <Sparkles size={15} className="shrink-0 text-violet-600" aria-hidden="true" />
        Teated on sorteeritud selle järgi, kas need puudutavad sinu tänaseid tunde.
      </p>
      {Object.entries(groups).map(([key, items]) => {
        if (!items.length) return null;
        const cat = MESSAGE_CATEGORIES[key];
        return (
          <section key={key} className="space-y-3">
            <div className="flex items-center gap-2">
              <cat.Icon size={16} className="text-stone-600" aria-hidden="true" />
              <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-stone-500">{cat.label}</h2>
              <span className="text-[13px] font-semibold tabular-nums text-stone-400">{items.length}</span>
              <div className="h-px flex-1 bg-stone-300" />
            </div>
            {items.map((m) => (
              <article key={m.id} className={`rounded-2xl border p-4 ${cat.cls}`}>
                <div className="flex items-center justify-between gap-2 text-[12px] font-semibold text-stone-500">
                  <span className="truncate">{m.sender}</span>
                  <span className="shrink-0 tabular-nums">{formatShortDate(m.date)}</span>
                </div>
                <h3 className="mt-1 font-['Bricolage_Grotesque',system-ui,sans-serif] text-[16px] font-semibold text-stone-900">{m.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-stone-700">{m.body}</p>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function CheatSheetView({ saved, onDelete }) {
  if (!saved.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center">
        <BookMarked size={28} className="text-stone-400" aria-hidden="true" />
        <h2 className="font-['Bricolage_Grotesque',system-ui,sans-serif] text-lg font-semibold text-stone-800">Spikker on veel tühi</h2>
        <p className="max-w-xs text-[14px] text-stone-500">Vajuta päevikus tunni kaardil „Konspekt”, koosta konspekt ja salvesta see siia.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {saved.map((n) => (
        <article key={n.id} className={`rounded-2xl border p-4 ${subjectColor(n.subject).card}`}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-semibold text-stone-500">
                {n.subject} · {formatDayHeading(n.date)}
              </p>
              <h3 className="font-['Bricolage_Grotesque',system-ui,sans-serif] text-[17px] font-semibold text-stone-900">{n.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => onDelete(n.id)}
              aria-label={`Kustuta konspekt „${n.title}”`}
              className="rounded-lg p-1.5 text-stone-500 hover:bg-white/70 hover:text-rose-700"
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
          <NotesBody notes={n} />
        </article>
      ))}
    </div>
  );
}

function NotesBody({ notes }) {
  return (
    <div className="mt-3 space-y-3">
      {notes.sections.map((s) => (
        <div key={s.heading}>
          <h4 className="text-[12px] font-bold uppercase tracking-[0.06em] text-stone-500">{s.heading}</h4>
          <ul className="mt-1 space-y-1">
            {s.items.map((i, idx) => (
              <li key={idx} className="flex gap-2 text-[14px] leading-relaxed text-stone-800">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-stone-500" aria-hidden="true" />
                <span>{i}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function NotesModal({ lesson, onClose, onSave }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  function acceptFile(f) {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setNotes(null);
  }

  async function generate() {
    setLoading(true);
    setSavedMsg("");
    try {
      setNotes(await synthesizeNotes({ lesson, imageFile: file }));
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(notesToText(notes));
      setSavedMsg("Kopeeritud");
    } catch {
      setSavedMsg("Kopeerimine ei õnnestunud");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92%] w-full max-w-lg flex-col rounded-t-3xl bg-[#FDFBF7] shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-stone-500">
              {lesson.subject} · {formatDayHeading(lesson.date)}
            </p>
            <h2 id="notes-title" className="font-['Bricolage_Grotesque',system-ui,sans-serif] text-xl font-bold leading-tight text-stone-900">
              Konspekt: {lesson.topic}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Sulge" className="rounded-full p-2 text-stone-500 hover:bg-stone-100">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {/* Lohistamise ala */}
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
              acceptFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40 ${
              dragging ? "border-sky-500 bg-[#E2EEF9]" : "border-stone-300 bg-white hover:border-stone-400"
            }`}
          >
            {preview ? (
              <>
                <img src={preview} alt="Üleslaetud pilt" className="max-h-44 rounded-xl object-contain" />
                <span className="text-[13px] text-stone-500">{file.name} · vajuta, et vahetada</span>
              </>
            ) : (
              <>
                <ImagePlus size={28} className="text-stone-400" aria-hidden="true" />
                <span className="text-[14px] font-semibold text-stone-700">Lohista siia pilt tahvlist või vihikust</span>
                <span className="text-[13px] text-stone-500">või vajuta, et valida fail</span>
              </>
            )}
            <input id="notes-image" ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => acceptFile(e.target.files?.[0])} />
          </div>

          {/* AI sünteesi kast */}
          <section className="rounded-2xl border border-violet-200 bg-gradient-to-b from-violet-50 to-white p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600" aria-hidden="true" />
              <h3 className="text-[14px] font-bold text-stone-900">AI süntees</h3>
            </div>
            <p className="mt-1 text-[13px] text-stone-600">
              Arvestab tunni teemat „{lesson.topic}”{file ? " ja üleslaetud pilti" : ""}.
            </p>

            {!notes && (
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-[14px] font-semibold text-[#FDFBF7] hover:bg-stone-800 disabled:opacity-70"
              >
                {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                {loading ? "Koostan konspekti…" : "Koosta konspekt"}
              </button>
            )}

            {notes && (
              <>
                <p className="mt-3 text-[12px] font-semibold text-stone-400">Allikas: {notes.source}</p>
                <NotesBody notes={notes} />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSave(notes);
                      setSavedMsg("Salvestatud spikrisse");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-[#FDFBF7] hover:bg-stone-800"
                  >
                    <BookMarked size={14} aria-hidden="true" />
                    Salvesta spikrisse
                  </button>
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-[13px] font-semibold text-stone-800 ring-1 ring-stone-900/10 hover:bg-stone-50"
                  >
                    <ClipboardCopy size={14} aria-hidden="true" />
                    Kopeeri
                  </button>
                  <button type="button" onClick={generate} className="px-2 py-2 text-[13px] font-semibold text-stone-600 hover:text-stone-900">
                    Koosta uuesti
                  </button>
                  {savedMsg && (
                    <span role="status" className="text-[13px] font-semibold text-emerald-700">
                      {savedMsg}
                    </span>
                  )}
                </div>
              </>
            )}
            <p className="mt-3 text-[11px] text-stone-400">Näidisrežiim: konspekt koostatakse tunni kirjelduse põhjal. Päris AI ühendatakse hiljem.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

const TABS = [
  { key: "diary", label: "Päevik", Icon: BookOpen },
  { key: "messages", label: "Sõnumid", Icon: MessageSquare },
  { key: "cheatsheet", label: "Spikker", Icon: BookMarked },
];

/* =====================================================================
   Päeviku vaade (kõik vahelehed). Andmed ja salvestamine tulevad väljast.
   ===================================================================== */

function Diary({ data, saved, onSaveNote, onDeleteNote, onImport, account }) {
  const [tab, setTab] = useState("diary");
  const [subject, setSubject] = useState(null);
  const [notesLesson, setNotesLesson] = useState(null);

  // Näidisandmete puhul on "täna" viimane päev andmetes, et vaade näeks realistlik välja.
  const todayIso = useMemo(() => {
    if (data.generatedAt) return new Date().toLocaleDateString("sv-SE");
    return data.lessons.reduce((max, l) => (l.date > max ? l.date : max), "");
  }, [data]);

  const todayAlerts = data.messages.filter((m) => classifyMessage(m, todayIso) === "today").length;

  function switchTab(key) {
    setTab(key);
    setSubject(null);
    window.scrollTo({ top: 0 });
  }

  const title = subject ? subject : TABS.find((t) => t.key === tab).label;
  const iconBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-700 ring-1 ring-stone-900/10 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40";

  return (
    <div className="min-h-full bg-[#FDFBF7] font-['Figtree',system-ui,sans-serif] text-stone-900">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-stone-200/70 bg-[#FDFBF7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-end justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-stone-400">
              {data.generatedAt ? `Uuendatud ${new Date(data.generatedAt).toLocaleString("et-EE", { dateStyle: "short", timeStyle: "short" })}` : "Näidisandmed"}
            </p>
            <h1 className="truncate font-['Bricolage_Grotesque',system-ui,sans-serif] text-[28px] font-bold leading-none tracking-tight">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {tab === "diary" && !subject && todayAlerts > 0 && (
              <button
                type="button"
                onClick={() => switchTab("messages")}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#FBE6EC] px-3 py-1.5 text-[12px] font-semibold text-rose-800 ring-1 ring-rose-200"
              >
                <Megaphone size={14} aria-hidden="true" />
                {todayAlerts}
                <span className="sr-only">teadet täna</span>
              </button>
            )}
            {onImport && (
              <button type="button" onClick={onImport} className={iconBtn} aria-label="Uuenda Stuudiumist" title="Uuenda Stuudiumist">
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            )}
            {account && (
              <button type="button" onClick={account.onClick} className={iconBtn} aria-label={account.label} title={account.label}>
                {account.signedIn ? <LogOut size={16} aria-hidden="true" /> : <LogIn size={16} aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-28 pt-4">
        {tab === "diary" &&
          (subject ? (
            <SubjectHistory subject={subject} lessons={data.lessons} onBack={() => setSubject(null)} onOpenNotes={setNotesLesson} />
          ) : (
            <DiaryView
              lessons={data.lessons}
              todayIso={todayIso}
              onImport={onImport}
              onOpenSubject={(s) => {
                setSubject(s);
                window.scrollTo({ top: 0 });
              }}
              onOpenNotes={setNotesLesson}
            />
          ))}
        {tab === "messages" && <MessagesView messages={data.messages} todayIso={todayIso} />}
        {tab === "cheatsheet" && <CheatSheetView saved={saved} onDelete={onDeleteNote} />}
      </main>

      {/* Alumine navigeerimisriba */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur" aria-label="Põhimenüü">
        <ul className="mx-auto grid max-w-xl grid-cols-3">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => switchTab(key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full flex-col items-center gap-1 py-2.5 text-[12px] font-semibold focus:outline-none focus-visible:bg-stone-100 ${active ? "text-stone-900" : "text-stone-400 hover:text-stone-600"}`}
                >
                  <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${active ? "bg-[#E3F1E4]" : ""}`}>
                    <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {notesLesson && <NotesModal lesson={notesLesson} onClose={() => setNotesLesson(null)} onSave={onSaveNote} />}
    </div>
  );
}

function FullScreenMessage({ children }) {
  return <div className="flex min-h-full items-center justify-center bg-[#FDFBF7] px-4 text-center font-['Figtree',system-ui,sans-serif] text-stone-500">{children}</div>;
}

const EMPTY_DIARY = { generatedAt: null, lessons: [], messages: [] };
const newNote = (n) => ({ ...n, id: `${n.date}-${n.subject}-${Date.now()}` });

/* =====================================================================
   Rakendus: valib režiimi
   - Supabase seadistamata  -> kohalik režiim (näidisandmed / stuudium_data.json, brauseri mälu)
   - Supabase seadistatud   -> sisselogimine, iga kasutaja andmed pilves
   ===================================================================== */

export default function App() {
  return supabase ? <CloudApp /> : <LocalApp />;
}

function LocalApp() {
  const [data, setData] = useState(MOCK_DATA);
  const [saved, setSaved] = useState(loadSaved);
  const [importOpen, setImportOpen] = useState(false);

  // Proovime lugeda Pythoni skripti loodud faili. Kui seda pole, jäävad näidisandmed.
  useEffect(() => {
    fetch("./stuudium_data.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => json && Array.isArray(json.lessons) && setData({ messages: [], ...json }))
      .catch(() => {});
  }, []);

  function update(next) {
    setSaved(next);
    persistSaved(next);
  }

  return (
    <>
      <Diary
        data={data}
        saved={saved}
        onSaveNote={(n) => update([newNote(n), ...saved])}
        onDeleteNote={(id) => update(saved.filter((n) => n.id !== id))}
        onImport={() => setImportOpen(true)}
      />
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImported={async (d) => setData(d)} />}
    </>
  );
}

function CloudApp() {
  const [session, setSession] = useState(undefined); // undefined = veel laadimas
  const [recovery, setRecovery] = useState(false);
  const [demo, setDemo] = useState(false);
  const [data, setData] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [demoSaved, setDemoSaved] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!userId) {
      setData(null);
      setSaved([]);
      return;
    }
    setDemo(false);
    setLoadError("");
    loadUserData(userId)
      .then(({ diary, notes }) => {
        setData(diary ? { messages: [], ...diary } : EMPTY_DIARY);
        setSaved(notes);
        if (!diary) setImportOpen(true);
      })
      .catch((e) => setLoadError(e.message || "Andmete laadimine ebaõnnestus."));
  }, [userId]);

  if (session === undefined) return <FullScreenMessage>Laen…</FullScreenMessage>;
  if (recovery) return <NewPasswordScreen onDone={() => setRecovery(false)} />;

  if (!session) {
    if (!demo) return <AuthScreen onDemo={() => setDemo(true)} />;
    return (
      <Diary
        data={MOCK_DATA}
        saved={demoSaved}
        onSaveNote={(n) => setDemoSaved([newNote(n), ...demoSaved])}
        onDeleteNote={(id) => setDemoSaved(demoSaved.filter((n) => n.id !== id))}
        account={{ signedIn: false, label: "Logi sisse", onClick: () => setDemo(false) }}
      />
    );
  }

  if (loadError) {
    return (
      <FullScreenMessage>
        <div className="space-y-3">
          <p>Andmete laadimine ebaõnnestus: {loadError}</p>
          <button type="button" onClick={() => supabase.auth.signOut()} className="font-semibold text-stone-800 underline">
            Logi välja
          </button>
        </div>
      </FullScreenMessage>
    );
  }
  if (!data) return <FullScreenMessage>Laen sinu päevikut…</FullScreenMessage>;

  async function persistNotes(next) {
    const prev = saved;
    setSaved(next);
    try {
      await saveNotes(userId, next);
    } catch {
      setSaved(prev);
    }
  }

  return (
    <>
      <Diary
        data={data}
        saved={saved}
        onSaveNote={(n) => persistNotes([newNote(n), ...saved])}
        onDeleteNote={(id) => persistNotes(saved.filter((n) => n.id !== id))}
        onImport={() => setImportOpen(true)}
        account={{ signedIn: true, label: `Logi välja (${session.user.email})`, onClick: () => supabase.auth.signOut() }}
      />
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={async (d) => {
            await saveDiary(userId, d);
            setData(d);
          }}
        />
      )}
    </>
  );
}
