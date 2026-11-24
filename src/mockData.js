// Näidisandmed. Täpselt sama struktuuriga faili (stuudium_data.json) kirjutab ka Pythoni skript.
//
// lesson.statusType väärtused: "present" | "grade" | "absent_excused" | "absent_unexcused" | "late"
// message.category väärtused (valikuline): "today" | "events" | "general"

export const MOCK_DATA = {
  generatedAt: null, // null tähendab, et need on näidisandmed
  lessons: [
    // --- Esmaspäev, 23. november ---
    {
      id: "l-2026-11-23-1",
      date: "2026-11-23",
      subject: "Lai matemaatika",
      topic: "Logaritmfunktsioon ja selle graafik",
      details:
        "Vaatasime logaritmfunktsiooni määramispiirkonda ja muutumispiirkonda. Joonestasime graafikud y = log₂x ja y = log₀,₅x ning võrdlesime neid. Kodus: õpik lk 84, ül 312–318.",
      links: [{ label: "TERA: Logaritmfunktsioon", url: "https://tera.ee/" }],
      status: "Kohal",
      statusType: "present",
    },
    {
      id: "l-2026-11-23-2",
      date: "2026-11-23",
      subject: "Inglise keel",
      topic: "Essay writing: argumentative structure",
      details:
        "Analüüsisime argumenteeriva essee ülesehitust: sissejuhatus koos väitega, kolm argumendilõiku, vastuargument ja kokkuvõte. Kodus: kirjuta 250-sõnaline essee teemal 'Should school start later?'.",
      links: [{ label: "TERA: Argumentative essay", url: "https://tera.ee/" }],
      status: "Kohal",
      statusType: "present",
    },
    {
      id: "l-2026-11-23-3",
      date: "2026-11-23",
      subject: "Liikumisõpetus",
      topic: "Korvpall: kahekäeline rinnaltsööt",
      details: "Soojendus, söödu tehnika paaris, lõpus väikeväljakul mäng 3×3.",
      links: [],
      status: "Kohal",
      statusType: "present",
    },

    // --- Reede, 20. november ---
    {
      id: "l-2026-11-20-1",
      date: "2026-11-20",
      subject: "Hispaania keel B1",
      topic: "Pretérito indefinido vs. imperfecto",
      details:
        "Harjutasime, millal kasutada lõpetatud ja lõpetamata minevikku. Lugesime teksti 'Un viaje a Sevilla' ja leidsime kõik minevikuvormid. Kodus: töövihik lk 41.",
      links: [{ label: "TERA: Minevikuvormid", url: "https://tera.ee/" }],
      status: "Hinne 84%",
      statusType: "grade",
    },
    {
      id: "l-2026-11-20-2",
      date: "2026-11-20",
      subject: "Lai matemaatika",
      topic: "Logaritmi omadused",
      details:
        "Korrutise, jagatise ja astme logaritm. Üleminek ühelt aluselt teisele. Lahendasime näiteid tahvlil.",
      links: [],
      status: "Puudus põhjendatud",
      statusType: "absent_excused",
    },

    // --- Neljapäev, 19. november ---
    {
      id: "l-2026-11-19-1",
      date: "2026-11-19",
      subject: "Inglise keel",
      topic: "Vocabulary: technology and society",
      details: "Uued sõnad peatükist 4 ja paaristöö arutelu teemal tehisintellekt koolis.",
      links: [{ label: "TERA: Unit 4 vocabulary", url: "https://tera.ee/" }],
      status: "Hinne 92%",
      statusType: "grade",
    },
    {
      id: "l-2026-11-19-2",
      date: "2026-11-19",
      subject: "Liikumisõpetus",
      topic: "Üldkehaline ettevalmistus",
      details: "Ringtreening 6 jaamaga, venitused.",
      links: [],
      status: "Hilinemine",
      statusType: "late",
    },

    // --- Teisipäev, 17. november ---
    {
      id: "l-2026-11-17-1",
      date: "2026-11-17",
      subject: "Lai matemaatika",
      topic: "Logaritmi mõiste",
      details:
        "Logaritmi definitsioon: log_a b = c ⇔ aᶜ = b. Arvutasime logaritmide väärtusi peast ja kalkulaatoriga.",
      links: [{ label: "TERA: Logaritmi mõiste", url: "https://tera.ee/" }],
      status: "Kohal",
      statusType: "present",
    },
    {
      id: "l-2026-11-17-2",
      date: "2026-11-17",
      subject: "Hispaania keel B1",
      topic: "Kuulamine: 'En el mercado'",
      details: "Kuulasime dialoogi turul ja täitsime lünktabeli. Sõnavara: puu- ja köögiviljad, hinnad.",
      links: [],
      status: "Puudus põhjendamata",
      statusType: "absent_unexcused",
    },

    // --- Teisipäev, 10. november ---
    {
      id: "l-2026-11-10-1",
      date: "2026-11-10",
      subject: "Lai matemaatika",
      topic: "Kontrolltöö: eksponentfunktsioon",
      details: "Kontrolltöö 45 minutit, 6 ülesannet.",
      links: [],
      status: "Hinne 78%",
      statusType: "grade",
    },
    {
      id: "l-2026-11-10-2",
      date: "2026-11-10",
      subject: "Hispaania keel B1",
      topic: "Pretérito indefinido: ebareeglipärased verbid",
      details: "ser/ir, tener, estar, hacer – pöördetabelid ja harjutused paaris.",
      links: [{ label: "TERA: Ebareeglipärased verbid", url: "https://tera.ee/" }],
      status: "Kohal",
      statusType: "present",
    },
    {
      id: "l-2026-11-10-3",
      date: "2026-11-10",
      subject: "Inglise keel",
      topic: "Reading: 'The Future of Work'",
      details: "Lugemisülesanne ja küsimustele vastamine. Arutelu: millised ametid kaovad?",
      links: [],
      status: "Kohal",
      statusType: "present",
    },
  ],

  upcoming: [
    { id: "u-1", date: "2026-11-24", subject: "Inglise keel", type: "homework", typeLabel: "Kodutöö", content: "Kirjuta 250-sõnaline essee teemal 'Should school start later?'" },
    { id: "u-2", date: "2026-11-25", subject: "Hispaania keel B1", type: "homework", typeLabel: "Kodutöö", content: "Töövihik lk 41–42" },
    { id: "u-3", date: "2026-11-26", subject: "Lai matemaatika", type: "test", typeLabel: "Kontrolltöö", content: "Logaritmid ja logaritmfunktsioon" },
    { id: "u-4", date: "2026-12-02", subject: "Inglise keel", type: "test", typeLabel: "Kontrolltöö", content: "Unit 4 vocabulary" },
  ],
  absenceSummary: null,

  messages: [
    {
      id: "m-1",
      date: "2026-11-23",
      sender: "Õppealajuhataja",
      title: "Asendustund: Lai matemaatika 4. tund",
      body: "Täna 4. tunnis asendab õpetaja Tamme õpetaja Kask. Tund toimub ruumis 214, teema jääb samaks.",
    },
    {
      id: "m-2",
      date: "2026-11-23",
      sender: "Liikumisõpetuse õpetaja",
      title: "Tänane tund toimub õues",
      body: "Ilma lubades toimub tänane liikumisõpetuse tund staadionil. Võtke kaasa soojad riided.",
    },
    {
      id: "m-3",
      date: "2026-11-21",
      sender: "Õpilasesindus",
      title: "Jõululaat 11. detsembril",
      body: "Ootame klasse oma letiga jõululaadale! Registreerimine kuni 4. detsembrini õpilasesinduse kaudu.",
    },
    {
      id: "m-4",
      date: "2026-11-20",
      sender: "Klassijuhataja",
      title: "Teatrikülastus 2. detsembril",
      body: "Läheme klassiga Vanemuisesse. Kogunemine kell 18.15 teatri ees. Pileti hind 12 €.",
    },
    {
      id: "m-5",
      date: "2026-11-18",
      sender: "Kooli juhtkond",
      title: "Uus sööklakorraldus",
      body: "Alates 1. detsembrist sööb gümnaasium pärast 3. tundi. Menüü leiab kooli kodulehelt.",
    },
    {
      id: "m-6",
      date: "2026-11-16",
      sender: "Raamatukogu",
      title: "Laenutatud õpikute tagastamine",
      body: "Palun tagasta eelmise õppeaasta õpikud raamatukokku hiljemalt 30. novembriks.",
    },
  ],
};
