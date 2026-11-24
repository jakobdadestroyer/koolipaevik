import React, { useState, useEffect, useMemo, useRef } from "react";
import { BookOpen, MessageSquare, Sparkles, ChevronDown, ChevronUp, FileText, ArrowLeft, X, ImagePlus, ExternalLink, CheckCircle2, Award, AlertCircle, Clock, ClipboardCopy, Loader2, CalendarDays, Megaphone, Info, BookMarked, Trash2, RefreshCw, LogIn, LogOut, Sun, Moon, ClipboardList, ChevronRight, BarChart3 } from "lucide-react";
import { MOCK_DATA } from "./mockData";
import { supabase, loadUserData, saveDiary, saveNotes } from "./supabase";
import { AuthScreen, NewPasswordScreen, ImportModal } from "./Account";
import { useExtensionSnapshot, mergeDiary, isNewer } from "./extensionBridge";
import { useTheme } from "./theme";

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
  present: { cls: "bg-card/70 text-emerald-800 dark:text-emerald-300 ring-emerald-700/15", Icon: CheckCircle2 },
  grade: { cls: "bg-indigo-600 text-white ring-indigo-700/20", Icon: Award },
  absent_excused: { cls: "bg-card/70 text-amber-800 dark:text-amber-300 ring-amber-700/20", Icon: AlertCircle },
  absent_unexcused: { cls: "bg-rose-600 text-white ring-rose-700/20", Icon: AlertCircle },
  late: { cls: "bg-card/70 text-orange-800 dark:text-orange-300 ring-orange-700/20", Icon: Clock },
};

// Iga aine saab oma pastelse kaardivärvi. Tundmatu aine saab värvi nime järgi.
const CARD_PALETTE = [
  { card: "bg-leaf border-leaf-line", dot: "bg-[#5E9E66]" }, // roheline
  { card: "bg-pool border-pool-line", dot: "bg-[#4E86BF]" }, // sinine
  { card: "bg-blush border-blush-line", dot: "bg-[#C46A86]" }, // roosa
  { card: "bg-butter border-butter-line", dot: "bg-[#B8922B]" }, // kollane
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
  today: { label: "Mõjutab tänast tundi", Icon: AlertCircle, cls: "bg-blush border-blush-line", chip: "bg-rose-600 text-white" },
  events: { label: "Üritused", Icon: CalendarDays, cls: "bg-butter border-butter-line", chip: "bg-amber-500 text-white" },
  general: { label: "Üldinfo", Icon: Info, cls: "bg-pool border-pool-line", chip: "bg-sky-600 text-white" },
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
                    className="inline-flex items-center gap-1.5 rounded-lg bg-card/80 px-2.5 py-1.5 text-[13px] font-medium text-stone-800 ring-1 ring-stone-900/10 hover:bg-card"
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
            className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 -ml-1.5 text-[13px] font-semibold text-stone-700 hover:bg-card/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40"
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
          className="inline-flex items-center gap-1.5 rounded-full bg-card/80 px-3 py-1 text-[12px] font-semibold text-stone-700 ring-1 ring-stone-900/10 hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40"
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
        {isToday && <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] tracking-[0.08em] text-paper">TÄNA</span>}
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
          <button type="button" onClick={onImport} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-[14px] font-semibold text-paper hover:bg-stone-800">
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
        className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-[14px] font-semibold text-stone-800 ring-1 ring-stone-900/10 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40"
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
            <div key={k} className="rounded-xl bg-card/70 py-2">
              <dd className="text-xl font-bold tabular-nums text-stone-900">{v}</dd>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-stone-500">{k}</dt>
            </div>
          ))}
        </dl>
      </header>

      <ol className="relative space-y-3 border-l-2 border-stone-200 pl-4">
        {items.map((l) => (
          <li key={l.id} className="relative">
            <span className={`absolute -left-[23px] top-5 h-3 w-3 rounded-full ring-4 ring-paper ${color.dot}`} aria-hidden="true" />
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
      <p className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 text-[13px] text-stone-600 ring-1 ring-stone-900/5">
        <Sparkles size={15} className="shrink-0 text-violet-600 dark:text-violet-300" aria-hidden="true" />
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
              className="rounded-lg p-1.5 text-stone-500 hover:bg-card/70 hover:text-rose-700 dark:hover:text-rose-300"
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
      {notes.links?.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold uppercase tracking-[0.06em] text-stone-500">Materjalid</h4>
          <ul className="mt-1 flex flex-wrap gap-2">
            {notes.links.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-card px-2.5 py-1.5 text-[13px] font-medium text-stone-800 ring-1 ring-stone-900/10 hover:bg-stone-50">
                  <ExternalLink size={13} aria-hidden="true" />
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="notes-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92%] w-full max-w-lg flex-col rounded-t-3xl bg-paper shadow-2xl sm:rounded-3xl"
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
              dragging ? "border-sky-500 bg-pool" : "border-stone-300 bg-card hover:border-stone-400"
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
          <section className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-gradient-to-b from-violet-50 dark:from-violet-950/40 to-card p-4">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-violet-600 dark:text-violet-300" aria-hidden="true" />
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
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-[14px] font-semibold text-paper hover:bg-stone-800 disabled:opacity-70"
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
                    className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-paper hover:bg-stone-800"
                  >
                    <BookMarked size={14} aria-hidden="true" />
                    Salvesta spikrisse
                  </button>
                  <button
                    type="button"
                    onClick={copy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-card px-3.5 py-2 text-[13px] font-semibold text-stone-800 ring-1 ring-stone-900/10 hover:bg-stone-50"
                  >
                    <ClipboardCopy size={14} aria-hidden="true" />
                    Kopeeri
                  </button>
                  <button type="button" onClick={generate} className="px-2 py-2 text-[13px] font-semibold text-stone-600 hover:text-stone-900">
                    Koosta uuesti
                  </button>
                  {savedMsg && (
                    <span role="status" className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
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

/* =====================================================================
   Tulemas: kodutööd ja kontrolltööd + kontrolltöö kordamiskonspekt
   ===================================================================== */

function dayDiff(iso, todayIso) {
  const [a, b] = [iso, todayIso].map((d) => Date.UTC(...d.split("-").map((x, i) => Number(x) - (i === 1 ? 1 : 0))));
  return Math.round((a - b) / 86400000);
}

function relativeDay(n) {
  if (n === 0) return "täna";
  if (n === 1) return "homme";
  if (n === -1) return "eile";
  return n > 1 ? `${n} päeva pärast` : `${-n} päeva tagasi`;
}

const TEST_WORDS = /kontrolltöö|arvestus|tasemetöö|\btest\b/i;

// Kogub kontrolltööle eelnenud tundide teemad üheks kordamiskonspektiks.
function buildTestPrep(test, lessons, upcoming = []) {
  const all = lessons.filter((l) => l.subject === test.subject && l.date < test.date).sort((a, b) => a.date.localeCompare(b.date));
  // Alustame pärast eelmist kontrolltööd (kui see on näha), muidu viimased 10 tundi.
  let start = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    if (TEST_WORDS.test(`${all[i].topic} ${all[i].details}`)) {
      start = i + 1;
      break;
    }
  }
  let used = all.slice(start);
  if (!used.length) used = all.slice(-10);

  const uniq = (arr) => [...new Set(arr.filter(Boolean))];
  const topics = uniq(used.map((l) => l.topic).filter((t) => t !== "Teema puudub"));
  const detailLines = uniq(used.flatMap((l) => (l.details || "").split("\n")).map((s) => s.trim()).filter((s) => s.length > 3));
  const homework = uniq([
    ...detailLines.filter((s) => /^kodutöö/i.test(s)),
    ...upcoming.filter((u) => u.subject === test.subject && u.type === "homework" && u.date <= test.date).map((u) => `${formatShortDate(u.date)}: ${u.content}`),
  ]);
  const covered = detailLines.filter((s) => !/^kodutöö/i.test(s)).slice(0, 20);
  const links = [];
  const seen = new Set();
  used.forEach((l) => (l.links || []).forEach((k) => !seen.has(k.url) && seen.add(k.url) && links.push(k)));

  const questions = topics.slice(-6).map((t, i) => (i % 2 === 0 ? `Selgita oma sõnadega: ${t}` : `Too näide või lahenda ülesanne teemal: ${t}`));

  return {
    title: `Kordamine: ${test.subject} ${test.typeLabel.toLowerCase()}`,
    subject: test.subject,
    date: test.date,
    source: used.length ? `${used.length} tunni teemad (${formatShortDate(used[0].date)}–${formatShortDate(used[used.length - 1].date)})` : "Selle aine tunde pole veel laaditud",
    sections: [
      { heading: test.typeLabel, items: [`${formatDayHeading(test.date)}${test.content ? ` · ${test.content}` : ""}`] },
      ...(topics.length ? [{ heading: "Teemad kordamiseks", items: used.filter((l) => l.topic !== "Teema puudub").map((l) => `${formatShortDate(l.date)} · ${l.topic}`) }] : []),
      ...(covered.length ? [{ heading: "Tunnis käsitletud", items: covered }] : []),
      ...(homework.length ? [{ heading: "Kodutööd ja ülesanded", items: homework }] : []),
      ...(questions.length ? [{ heading: "Kontrolli ennast", items: questions }] : []),
    ],
    links,
  };
}

function TestPrepModal({ test, lessons, upcoming, onClose, onSave }) {
  const notes = useMemo(() => buildTestPrep(test, lessons, upcoming), [test, lessons, upcoming]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="prep-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92%] w-full max-w-lg flex-col rounded-t-3xl bg-paper shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-stone-500">
              {test.subject} · {formatDayHeading(test.date)}
            </p>
            <h2 id="prep-title" className="font-['Bricolage_Grotesque',system-ui,sans-serif] text-xl font-bold leading-tight text-stone-900">
              Kordamiskonspekt
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Sulge" className="rounded-full p-2 text-stone-500 hover:bg-stone-100">
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">
          <p className="text-[12px] font-semibold text-stone-400">Allikas: {notes.source}</p>
          <NotesBody notes={notes} />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onSave(notes);
                setMsg("Salvestatud spikrisse");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-[13px] font-semibold text-paper hover:bg-stone-800"
            >
              <BookMarked size={14} aria-hidden="true" />
              Salvesta spikrisse
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(notesToText(notes));
                  setMsg("Kopeeritud");
                } catch {
                  setMsg("Kopeerimine ebaõnnestus");
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-card px-3.5 py-2 text-[13px] font-semibold text-stone-800 ring-1 ring-stone-900/10 hover:bg-stone-50"
            >
              <ClipboardCopy size={14} aria-hidden="true" />
              Kopeeri
            </button>
            {msg && (
              <span role="status" className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
                {msg}
              </span>
            )}
          </div>
          <p className="mt-3 text-[11px] text-stone-400">Koostatud sinu tundide teemadest ja kirjeldustest. Kontrolli õpikust ja vihikust üle.</p>
        </div>
      </div>
    </div>
  );
}

function NextTestBanner({ test, todayIso, onOpen }) {
  const n = dayDiff(test.date, todayIso);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-blush-line bg-blush px-4 py-3 text-left hover:shadow-[0_2px_12px_rgba(60,50,30,0.08)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
        <ClipboardList size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold uppercase tracking-[0.06em] text-rose-800 dark:text-rose-300">
          {test.typeLabel} {relativeDay(n)}
        </span>
        <span className="block truncate font-semibold text-stone-900">
          {test.subject}
          {test.content ? ` · ${test.content}` : ""}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-stone-500" aria-hidden="true" />
    </button>
  );
}

function UpcomingView({ upcoming, todayIso, onPrep, onImport }) {
  const items = (upcoming || []).filter((u) => u.date >= todayIso);
  const groups = useMemo(() => {
    const m = new Map();
    items.forEach((u) => {
      if (!m.has(u.date)) m.set(u.date, []);
      m.get(u.date).push(u);
    });
    return [...m.entries()];
  }, [items]);

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center">
        <CalendarDays size={28} className="text-stone-400" aria-hidden="true" />
        <h2 className="font-['Bricolage_Grotesque',system-ui,sans-serif] text-lg font-semibold text-stone-800">Tulevasi töid pole</h2>
        <p className="max-w-xs text-[14px] text-stone-500">Siia tulevad Stuudiumi kodutööd ja kontrolltööd. Uuenda päevikut, et näha värskeimat seisu.</p>
        {onImport && (
          <button type="button" onClick={onImport} className="mt-1 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-[14px] font-semibold text-paper hover:bg-stone-800">
            <RefreshCw size={15} aria-hidden="true" />
            Uuenda Stuudiumist
          </button>
        )}
      </div>
    );
  }

  const tests = items.filter((u) => u.type === "test");

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-blush-line bg-blush p-3">
          <dd className="text-2xl font-bold tabular-nums text-stone-900">{tests.length}</dd>
          <dt className="text-[12px] font-semibold text-stone-600">kontrolltööd tulemas</dt>
        </div>
        <div className="rounded-2xl border border-pool-line bg-pool p-3">
          <dd className="text-2xl font-bold tabular-nums text-stone-900">{items.length - tests.length}</dd>
          <dt className="text-[12px] font-semibold text-stone-600">kodutööd tulemas</dt>
        </div>
      </dl>

      {groups.map(([date, list]) => {
        const n = dayDiff(date, todayIso);
        return (
          <section key={date} className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="shrink-0 text-[13px] font-bold uppercase tracking-[0.06em] text-stone-500">
                {formatDayHeading(date)}
                <span className="ml-2 normal-case tracking-normal text-stone-400">{relativeDay(n)}</span>
              </h2>
              <div className="h-px flex-1 bg-stone-300" />
            </div>
            {list.map((u) => {
              const isTest = u.type === "test";
              return (
                <article key={u.id} className={`rounded-2xl border p-4 ${isTest ? "border-blush-line bg-blush" : subjectColor(u.subject).card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[13px] font-semibold text-stone-600">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${subjectColor(u.subject).dot}`} aria-hidden="true" />
                        {u.subject}
                      </div>
                      <p className="mt-1 whitespace-pre-line text-[15px] leading-snug text-stone-900">{u.content || u.typeLabel}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${isTest ? "bg-rose-600 text-white" : "bg-card/70 text-stone-700 ring-1 ring-stone-900/10"}`}>
                      {u.typeLabel}
                    </span>
                  </div>
                  {isTest && (
                    <button
                      type="button"
                      onClick={() => onPrep(u)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-[13px] font-semibold text-stone-800 ring-1 ring-stone-900/10 hover:bg-stone-50"
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      Koosta kordamiskonspekt
                    </button>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
      <p className="text-center text-[12px] text-stone-400">Stuudiumi avaleht ei näita tunniplaani, seega on siin kodutööd ja kontrolltööd.</p>
    </div>
  );
}

/* =====================================================================
   Ülevaade: puudumised, hilinemised, hinded
   ===================================================================== */

const marks = (l) => {
  const s = l.status || "";
  const absent = /puudus/i.test(s);
  return { absent, unexcused: absent && !/põhjendatud/i.test(s), late: /hilin/i.test(s) };
};
const gradePct = (l) => {
  const m = l.statusType === "grade" && (l.status || "").match(/(\d+(?:[.,]\d+)?)\s*%/);
  return m ? Number(m[1].replace(",", ".")) : null;
};

const FILTERS = [
  { key: "all", label: "Kõik", test: (m) => m.absent || m.late },
  { key: "absent", label: "Puudumised", test: (m) => m.absent },
  { key: "unexcused", label: "Põhjuseta", test: (m) => m.unexcused },
  { key: "late", label: "Hilinemised", test: (m) => m.late },
];

function OverviewView({ lessons, absenceSummary, onOpenSubject }) {
  const [filter, setFilter] = useState("all");
  const stats = useMemo(() => {
    let absent = 0, unexcused = 0, late = 0;
    const bySubject = new Map();
    lessons.forEach((l) => {
      const m = marks(l);
      const g = gradePct(l);
      if (!bySubject.has(l.subject)) bySubject.set(l.subject, { subject: l.subject, absent: 0, late: 0, grades: [] });
      const row = bySubject.get(l.subject);
      if (m.absent) (absent++, row.absent++);
      if (m.unexcused) unexcused++;
      if (m.late) (late++, row.late++);
      if (g !== null) row.grades.push(g);
    });
    return { absent, unexcused, late, subjects: [...bySubject.values()].sort((a, b) => a.subject.localeCompare(b.subject, "et")) };
  }, [lessons]);

  const fromStuudium = Boolean(absenceSummary);
  const tiles = [
    { label: "Puudumisi", value: fromStuudium ? absenceSummary.total : stats.absent, cls: "border-butter-line bg-butter" },
    { label: "Põhjuseta", value: fromStuudium && absenceSummary.unexcused != null ? absenceSummary.unexcused : stats.unexcused, cls: "border-blush-line bg-blush" },
    { label: "Hilinemisi", value: stats.late, cls: "border-pool-line bg-pool" },
  ];
  const active = FILTERS.find((f) => f.key === filter);
  const list = [...lessons].filter((l) => active.test(marks(l))).sort((a, b) => b.date.localeCompare(a.date));
  const graded = stats.subjects.filter((s) => s.grades.length);

  return (
    <div className="space-y-7">
      <section className="space-y-2">
        <dl className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className={`rounded-2xl border p-3 ${t.cls}`}>
              <dd className="text-2xl font-bold tabular-nums text-stone-900">{t.value}</dd>
              <dt className="text-[12px] font-semibold text-stone-600">{t.label}</dt>
            </div>
          ))}
        </dl>
        <p className="text-[12px] text-stone-400">
          {fromStuudium ? "Puudumised: kogu perioodi kokkuvõte Stuudiumist. Hilinemised: laaditud tundidest." : "Arvestatud laaditud tundide põhjal."}
        </p>
      </section>

      {graded.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-stone-500">Hinded ainete kaupa</h2>
          <ul className="space-y-2">
            {graded.map((s) => {
              const avg = Math.round(s.grades.reduce((a, b) => a + b, 0) / s.grades.length);
              return (
                <li key={s.subject}>
                  <button type="button" onClick={() => onOpenSubject(s.subject)} className="w-full rounded-xl bg-card px-3 py-2.5 text-left ring-1 ring-stone-900/5 hover:ring-stone-900/15">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[14px] font-semibold text-stone-800">{s.subject}</span>
                      <span className="shrink-0 text-[14px] font-bold tabular-nums text-stone-900">
                        {avg}% <span className="text-[12px] font-medium text-stone-400">· {s.grades.length} hinnet</span>
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className={`h-full rounded-full ${avg >= 75 ? "bg-emerald-500" : avg >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${avg}%` }} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-stone-500">Puudumised ja hilinemised ainete kaupa</h2>
        <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-stone-900/5">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="text-left text-[12px] font-semibold text-stone-500">
                <th className="px-3 py-2 font-semibold">Aine</th>
                <th className="px-3 py-2 text-right font-semibold">Puudus</th>
                <th className="px-3 py-2 text-right font-semibold">Hilines</th>
              </tr>
            </thead>
            <tbody>
              {stats.subjects
                .filter((s) => s.absent || s.late)
                .sort((a, b) => b.absent + b.late - (a.absent + a.late))
                .map((s) => (
                  <tr key={s.subject} className="border-t border-stone-100">
                    <td className="px-3 py-2 text-stone-800">{s.subject}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-stone-900">{s.absent || "–"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-stone-900">{s.late || "–"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-stone-500">Kõik märked</h2>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Märgete filter">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 ${filter === f.key ? "bg-stone-900 text-paper ring-stone-900" : "bg-card text-stone-600 ring-stone-900/10 hover:text-stone-900"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {list.length ? (
          <ul className="divide-y divide-stone-100 rounded-xl bg-card ring-1 ring-stone-900/5">
            {list.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => onOpenSubject(l.subject)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-stone-50">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-stone-800">{l.subject}</span>
                    <span className="block text-[12px] tabular-nums text-stone-500">{formatDayHeading(l.date)}</span>
                  </span>
                  <StatusPill lesson={l} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-card px-3 py-6 text-center text-[14px] text-stone-500 ring-1 ring-stone-900/5">Selliseid märkeid pole.</p>
        )}
      </section>
    </div>
  );
}

const TABS = [
  { key: "diary", label: "Päevik", Icon: BookOpen },
  { key: "upcoming", label: "Tulemas", Icon: CalendarDays },
  { key: "overview", label: "Ülevaade", Icon: BarChart3 },
  { key: "messages", label: "Sõnumid", Icon: MessageSquare },
  { key: "cheatsheet", label: "Spikker", Icon: BookMarked },
];

/* =====================================================================
   Päeviku vaade (kõik vahelehed). Andmed ja salvestamine tulevad väljast.
   ===================================================================== */

function Diary({ data, saved, onSaveNote, onDeleteNote, onImport, account }) {
  const [tab, setTab] = useState("diary");
  const [prepTest, setPrepTest] = useState(null);
  const [theme, toggleTheme] = useTheme();
  const [subject, setSubject] = useState(null);
  const [notesLesson, setNotesLesson] = useState(null);

  // Näidisandmete puhul on "täna" viimane päev andmetes, et vaade näeks realistlik välja.
  const todayIso = useMemo(() => {
    if (data.generatedAt) return new Date().toLocaleDateString("sv-SE");
    return data.lessons.reduce((max, l) => (l.date > max ? l.date : max), "");
  }, [data]);

  const todayAlerts = data.messages.filter((m) => classifyMessage(m, todayIso) === "today").length;
  const nextTest = (data.upcoming || []).find((u) => u.type === "test" && u.date >= todayIso && dayDiff(u.date, todayIso) <= 7);

  function switchTab(key) {
    setTab(key);
    setSubject(null);
    window.scrollTo({ top: 0 });
  }

  const title = subject ? subject : TABS.find((t) => t.key === tab).label;
  const iconBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-full bg-card text-stone-700 ring-1 ring-stone-900/10 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-800/40";

  return (
    <div className="min-h-full bg-paper font-['Figtree',system-ui,sans-serif] text-stone-900">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-stone-200/70 bg-paper/95 backdrop-blur">
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
                className="inline-flex items-center gap-1.5 rounded-full bg-blush px-3 py-1.5 text-[12px] font-semibold text-rose-800 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-900"
              >
                <Megaphone size={14} aria-hidden="true" />
                {todayAlerts}
                <span className="sr-only">teadet täna</span>
              </button>
            )}
            <button type="button" onClick={toggleTheme} className={iconBtn} aria-label={theme === "dark" ? "Hele teema" : "Tume teema"} title={theme === "dark" ? "Hele teema" : "Tume teema"}>
              {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            </button>
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
        {tab === "diary" && !subject && nextTest && <NextTestBanner test={nextTest} todayIso={todayIso} onOpen={() => switchTab("upcoming")} />}
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
        {tab === "upcoming" && <UpcomingView upcoming={data.upcoming} todayIso={todayIso} onPrep={setPrepTest} onImport={onImport} />}
        {tab === "overview" && (
          <OverviewView
            lessons={data.lessons}
            absenceSummary={data.absenceSummary}
            onOpenSubject={(s) => {
              setTab("diary");
              setSubject(s);
              window.scrollTo({ top: 0 });
            }}
          />
        )}
        {tab === "messages" && <MessagesView messages={data.messages} todayIso={todayIso} />}
        {tab === "cheatsheet" && <CheatSheetView saved={saved} onDelete={onDeleteNote} />}
      </main>

      {/* Alumine navigeerimisriba */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur" aria-label="Põhimenüü">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map(({ key, label, Icon }) => {
            const active = tab === key;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => switchTab(key)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-semibold focus:outline-none focus-visible:bg-stone-100 ${active ? "text-stone-900" : "text-stone-400 hover:text-stone-600"}`}
                >
                  <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${active ? "bg-leaf" : ""}`}>
                    <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {prepTest && <TestPrepModal test={prepTest} lessons={data.lessons} upcoming={data.upcoming} onClose={() => setPrepTest(null)} onSave={onSaveNote} />}
      {notesLesson && <NotesModal lesson={notesLesson} onClose={() => setNotesLesson(null)} onSave={onSaveNote} />}
    </div>
  );
}

function FullScreenMessage({ children }) {
  return <div className="flex min-h-full items-center justify-center bg-paper px-4 text-center font-['Figtree',system-ui,sans-serif] text-stone-500">{children}</div>;
}

function Toast({ text }) {
  if (!text) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+12px)] z-[60] flex justify-center px-4">
      <span className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-[13px] font-semibold text-paper shadow-lg">
        <CheckCircle2 size={15} aria-hidden="true" />
        {text}
      </span>
    </div>
  );
}

function useToast() {
  const [text, setText] = useState("");
  const timer = useRef(null);
  function show(t) {
    setText(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), 4000);
  }
  return [text, show];
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
  const { installed, snapshot, error: syncError } = useExtensionSnapshot();
  const [toast, showToast] = useToast();
  useEffect(() => {
    if (syncError) showToast(syncError);
  }, [syncError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Laiendus tõi uue päeviku: võtame selle kasutusele.
  useEffect(() => {
    if (!snapshot || !isNewer(snapshot, data)) return;
    setData((d) => mergeDiary(d.generatedAt ? d : null, snapshot));
    showToast(`Uuendatud e-päevikust · ${snapshot.lessons.length} tundi`);
  }, [snapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Proovime lugeda Pythoni skripti loodud faili. Kui seda pole, jäävad näidisandmed.
  useEffect(() => {
    fetch("./stuudium_data.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => json && Array.isArray(json.lessons) && setData((d) => (isNewer(json, d) ? { messages: [], ...json } : d)))
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
      {importOpen && (
        <ImportModal
          extensionInstalled={installed}
          onClose={() => setImportOpen(false)}
          onImported={async (d) => setData((old) => mergeDiary(old.generatedAt ? old : null, d))}
        />
      )}
      <Toast text={toast} />
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
  const { installed, snapshot, error: syncError } = useExtensionSnapshot();
  const [toast, showToast] = useToast();
  useEffect(() => {
    if (syncError) showToast(syncError);
  }, [syncError]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Laiendus tõi uue päeviku: liidame olemasolevaga ja salvestame kontole.
  useEffect(() => {
    if (!userId || !data || !snapshot || !isNewer(snapshot, data)) return;
    const merged = mergeDiary(data, snapshot);
    setData(merged);
    setImportOpen(false);
    saveDiary(userId, merged)
      .then(() => showToast(`Uuendatud e-päevikust · ${snapshot.lessons.length} tundi`))
      .catch(() => showToast("Salvestamine ebaõnnestus. Proovi lehte värskendada."));
  }, [userId, data, snapshot]); // eslint-disable-line react-hooks/exhaustive-deps

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
          extensionInstalled={installed}
          onClose={() => setImportOpen(false)}
          onImported={async (d) => {
            const merged = mergeDiary(data, d);
            await saveDiary(userId, merged);
            setData(merged);
          }}
        />
      )}
      <Toast text={toast} />
    </>
  );
}
