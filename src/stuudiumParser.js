// Loeb brauseris salvestatud Stuudiumi päeviku lehe (HTML) ja teeb sellest rakenduse andmed.
// Kõik toimub kasutaja enda brauseris: fail ei lähe kuhugi, salvestatakse ainult tulemus.

const SEL = {
  day: ".daily-summaries-segment",
  dayHeading: ".daily-summaries-segment-heading",
  lesson: ".daily-summaries-segment-block-lesson",
  lessonSubject: ".daily-summaries-segment-lesson-subject",
  lessonNotes: ".daily-summaries-segment-lesson-notes",
  lessonHomework: ".daily-summaries-segment-lesson-homework-contents",
  link: "a.st-link",
  linkLabel: ".slsfx",
  event: ".stream-entry",
  eventContext: ".stream-entry-context:not(.stream-entry-context-secondary) a",
  eventTopic: ".stream-entry-context-secondary .st-ucontent",
  grade: ".grade-current",
  absentExcused: ".grade-param-is_absent-excused",
  absent: ".grade-param-is_absent",
  late: ".grade-param-is_late",
};

const EST_MONTHS = {
  jaanuar: 1, veebruar: 2, märts: 3, aprill: 4, mai: 5, juuni: 6,
  juuli: 7, august: 8, september: 9, oktoober: 10, november: 11, detsember: 12,
};

const pad = (n) => String(n).padStart(2, "0");

// "Täna, 24. november" / "21. november, laupäev" / "Keemia, T 24. november" -> "2026-11-24"
function parseDay(text, today) {
  const m = (text || "").toLowerCase().normalize("NFC").match(/(\d{1,2})\.\s*([a-zõäöüšž]+)/);
  if (!m || !EST_MONTHS[m[2]]) return null;
  const month = EST_MONTHS[m[2]];
  const year = month <= today.getMonth() + 2 ? today.getFullYear() : today.getFullYear() - 1;
  return `${year}-${pad(month)}-${pad(Number(m[1]))}`;
}

// Elemendi tekst ridadena, ilma linkideta ja tühjade ridadeta.
function cleanText(el) {
  if (!el) return "";
  const c = el.cloneNode(true);
  c.querySelectorAll(SEL.link).forEach((a) => a.remove());
  c.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  return c.textContent
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function extractLinks(origin, ...els) {
  const out = [];
  const seen = new Set();
  els.filter(Boolean).forEach((el) =>
    el.querySelectorAll(SEL.link).forEach((a) => {
      let url = a.getAttribute("href") || "";
      if (url.startsWith("/")) url = origin + url;
      if (!/^https?:\/\//.test(url) || seen.has(url)) return;
      seen.add(url);
      const label = a.querySelector(SEL.linkLabel)?.textContent.trim() || url;
      out.push({ label: label.replace(/^Tera:/, "TERA:"), url });
    })
  );
  return out;
}

function splitTopic(notes) {
  if (!notes) return ["", ""];
  const i = notes.indexOf("\n");
  const first = i === -1 ? notes : notes.slice(0, i);
  const rest = i === -1 ? "" : notes.slice(i + 1);
  if (first.length > 110) {
    let cut = first.lastIndexOf(" ", 100);
    if (cut < 40) cut = 100;
    return [first.slice(0, cut).replace(/[,.;:]+$/, "") + "…", notes];
  }
  return [first, rest];
}

function parseEvent(entry, today) {
  const ctx = entry.querySelector(SEL.eventContext);
  if (!ctx) return null;
  const text = ctx.textContent.replace(/\s+/g, " ").trim();
  const comma = text.lastIndexOf(",");
  if (comma === -1) return null; // nt kursusehinne ilma kuupäevata
  const subject = text.slice(0, comma).trim();
  const date = parseDay(text.slice(comma + 1), today);
  if (!date) return null;

  let grade = (entry.querySelector(SEL.grade)?.textContent || "").replace(/\s+/g, "").replace(/\(\w+\)$/, "");
  let absence = "";
  let absType = "";
  if (entry.querySelector(SEL.absentExcused)) [absence, absType] = ["Puudus põhjendatud", "absent_excused"];
  else if (entry.querySelector(SEL.absent)) [absence, absType] = ["Puudus", "absent_unexcused"];
  else if (entry.querySelector(SEL.late)) [absence, absType] = ["Hilines", "late"];

  if (grade && grade.replace(/[\d%,.]/g, "").length <= 2) grade = `Hinne ${grade}`;
  let status;
  let statusType;
  if (grade && absence) [status, statusType] = [`${grade} · ${absence}`, "grade"];
  else if (grade) [status, statusType] = [grade, "grade"];
  else if (absence) [status, statusType] = [absence, absType];
  else return null;

  return { subject, date, status, statusType, topic: cleanText(entry.querySelector(SEL.eventTopic)) };
}


// Tulevased kodutööd ja kontrolltööd ("Ülesanded, kodutööd ja kontrolltööd")
function parseUpcoming(doc) {
  const out = [];
  const seen = new Set();
  doc.querySelectorAll(".todo_container").forEach((el) => {
    const key = el.getAttribute("data-item-key") || "";
    const raw = el.getAttribute("data-date") || "";
    if (!/^\d{8}$/.test(raw) || seen.has(key)) return;
    seen.add(key);
    const badge = el.querySelector(".scheduled-type-badge");
    const isTest = key.startsWith("Test-") || (badge && /scheduled-type-badge-test/.test(badge.className));
    out.push({
      id: key || `u-${raw}-${out.length}`,
      date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      subject: el.querySelector(".subject_name")?.textContent.replace(/\s+/g, " ").trim() || "",
      type: isTest ? "test" : "homework",
      typeLabel: badge?.textContent.trim() || (isTest ? "Kontrolltöö" : "Kodutöö"),
      content: cleanText(el.querySelector(".todo_content")),
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// "Puudumisi kokku: 42 (10 põhjuseta)"
function parseAbsenceSummary(doc) {
  for (const el of doc.querySelectorAll(".section-infomessage")) {
    const m = el.textContent.replace(/\s+/g, " ").match(/Puudumisi kokku:\s*(\d+)(?:\s*\((\d+)\s*põhjuseta\))?/i);
    if (m) return { total: Number(m[1]), unexcused: m[2] ? Number(m[2]) : null };
  }
  return null;
}

// Peamine funktsioon: HTML-tekst -> { generatedAt, lessons, messages }
export function parseStuudiumHtml(html, { today = new Date(), savedAt = new Date() } = {}) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const origin = html.match(/https:\/\/[a-z0-9-]+\.ope\.ee/i)?.[0] || "";
  const lessons = [];
  const events = [];
  const seenIds = new Set();
  const seenEvents = new Set();

  doc.querySelectorAll(SEL.day).forEach((seg) => {
    const date = parseDay(seg.querySelector(SEL.dayHeading)?.textContent, today);
    if (!date) return;
    seg.querySelectorAll(SEL.event).forEach((e) => {
      const ev = parseEvent(e, today);
      const k = ev && `${ev.subject}|${ev.date}|${ev.status}`;
      if (ev && !seenEvents.has(k)) {
        seenEvents.add(k);
        events.push(ev);
      }
    });
    seg.querySelectorAll(SEL.lesson).forEach((row, idx) => {
      const subj = row.querySelector(SEL.lessonSubject);
      if (!subj) return;
      const sid = row.getAttribute("data-ds-lesson");
      if (sid && seenIds.has(sid)) return; // sama tund mitu korda lehel
      if (sid) seenIds.add(sid);
      const notesEl = row.querySelector(SEL.lessonNotes);
      const hwEl = row.querySelector(SEL.lessonHomework);
      const [topic, details] = splitTopic(cleanText(notesEl));
      const homework = cleanText(hwEl).replace(/:\n/g, ": ");
      lessons.push({
        id: row.getAttribute("data-ds-lesson") || `l-${date}-${idx + 1}`,
        date,
        subject: subj.textContent.replace(/\s+/g, " ").trim(),
        topic: topic || "Teema puudub",
        details: [details, homework].filter(Boolean).join("\n\n"),
        links: extractLinks(origin, notesEl, hwEl),
        status: "Kohal",
        statusType: "present",
      });
    });
  });

  // Hinded ja puudumised tundidega kokku (sama aine + kuupäev)
  const byKey = new Map();
  lessons.forEach((l) => {
    const k = `${l.subject}|${l.date}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(l);
  });
  events.forEach((ev) => {
    const k = `${ev.subject}|${ev.date}`;
    const targets = byKey.get(k);
    if (targets) {
      targets.forEach((t) => {
        if (t.statusType === "present" || ev.statusType === "grade") {
          t.status = ev.status;
          t.statusType = ev.statusType;
        }
      });
    } else {
      const [first, ...rest] = ev.topic.split("\n");
      const l = {
        id: `e-${ev.date}-${lessons.length}`,
        date: ev.date,
        subject: ev.subject,
        topic: first || "Teema puudub",
        details: rest.join("\n"),
        links: [],
        status: ev.status,
        statusType: ev.statusType,
      };
      lessons.push(l);
      byKey.set(k, [l]);
    }
  });

  lessons.sort((a, b) => b.date.localeCompare(a.date));
  return {
    generatedAt: savedAt.toISOString(),
    lessons,
    messages: [],
    upcoming: parseUpcoming(doc),
    absenceSummary: parseAbsenceSummary(doc),
  };
}
