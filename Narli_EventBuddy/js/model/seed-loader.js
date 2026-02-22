// Daten-Loader: Holt Initialdaten via JSON oder Fallback
const FALLBACK_SEED = {
  currentUserId: "u1",
  users: [{ id: "u1", name: "Anna Berger" }],
  tags: [
    { id: "t1", name: "Party" }, { id: "t2", name: "Workshop" },
    { id: "t3", name: "Sport" }, { id: "t4", name: "Networking" },
    { id: "t5", name: "Studium" }, { id: "t6", name: "Kultur" },
    { id: "t7", name: "Outdoor" }, { id: "t8", name: "Verein" }
  ],
  participants: [
    { id: "p1", firstName: "Lena", lastName: "Klein", nickname: "Lena K.", email: "lena.klein@email.com", avatar: "" },
    { id: "p2", firstName: "Paul", lastName: "Mayer", nickname: "Paul M.", email: "paul.mayer@email.com", avatar: "" },
    { id: "p3", firstName: "Nina", lastName: "Huber", nickname: "Nina H.", email: "nina.huber@email.com", avatar: "" },
    { id: "p4", firstName: "David", lastName: "Schmidt", nickname: "Dave", email: "david.schmidt@email.com", avatar: "" },
    { id: "p5", firstName: "Mia", lastName: "Leitner", nickname: "Mia L.", email: "mia.leitner@email.com", avatar: "" },
    { id: "p6", firstName: "Jonas", lastName: "Bauer", nickname: "Jonas B.", email: "jonas.bauer@email.com", avatar: "" },
    { id: "p7", firstName: "Sarah", lastName: "Winkler", nickname: "Sarah W.", email: "sarah.winkler@email.com", avatar: "" },
    { id: "p8", firstName: "Felix", lastName: "Aigner", nickname: "Felix A.", email: "felix.aigner@email.com", avatar: "" },
    { id: "p9", firstName: "Lukas", lastName: "Pichler", nickname: "Luki", email: "lukas.pichler@email.com", avatar: "" },
    { id: "p10", firstName: "Marie", lastName: "Gruber", nickname: "Marie G.", email: "marie.gruber@email.com", avatar: "" },
    { id: "p11", firstName: "Tom", lastName: "Reiter", nickname: "Tom R.", email: "tom.reiter@email.com", avatar: "" },
    { id: "p12", firstName: "Julia", lastName: "Moser", nickname: "Jules", email: "julia.moser@email.com", avatar: "" }
  ],
  events: [
    {
      id: "e1", title: "Semester Kickoff", date: "2026-03-10", time: "18:00",
      location: "Campus Forum", description: "Starte gemeinsam mit anderen Studierenden voller Energie ins neue Semester...",
      status: "planned", tagIds: ["t1", "t5"],
      participants: [{ participantId: "p1", status: "yes" }, { participantId: "p3", status: "yes" }, { participantId: "p6", status: "maybe" }, { participantId: "p10", status: "yes" }]
    },
    {
      id: "e2", title: "UI Workshop", date: "2026-03-22", time: "09:30",
      location: "Lab 2", description: "In diesem praxisorientierten Workshop dreht sich alles um modernes UI-Design...",
      status: "planned", tagIds: ["t2", "t5"],
      participants: [{ participantId: "p2", status: "yes" }, { participantId: "p4", status: "yes" }, { participantId: "p7", status: "maybe" }, { participantId: "p12", status: "yes" }]
    },
    {
      id: "e3", title: "Run Club Morning", date: "2026-02-01", time: "07:30",
      location: "Donaupark", description: "Beginne den Tag aktiv mit einer Laufrunde entlang der Donau...",
      status: "completed", tagIds: ["t3", "t7"],
      participants: [{ participantId: "p5", status: "yes" }, { participantId: "p8", status: "yes" }, { participantId: "p9", status: "yes" }, { participantId: "p11", status: "no" }]
    },
    {
      id: "e4", title: "Alumni Connect", date: "2026-04-15", time: "17:30",
      location: "Business Lounge", description: "Lerne ehemalige Studierende und spannende Unternehmen kennen...",
      status: "planned", tagIds: ["t4", "t5"],
      participants: [{ participantId: "p1", status: "yes" }, { participantId: "p4", status: "maybe" }, { participantId: "p8", status: "yes" }, { participantId: "p12", status: "yes" }]
    },
    {
      id: "e5", title: "Museum Night", date: "2026-01-12", time: "19:00",
      location: "Stadtmuseum", description: "Erlebe Kunst und Kultur einmal anders bei unserer Museumsnacht...",
      status: "completed", tagIds: ["t6"],
      participants: [{ participantId: "p2", status: "yes" }, { participantId: "p3", status: "yes" }, { participantId: "p6", status: "maybe" }, { participantId: "p10", status: "yes" }]
    },
    {
      id: "e6", title: "Vereinsabend Spiele", date: "2026-05-05", time: "18:30",
      location: "Vereinshaus Mitte", description: "Ein gemütlicher Abend voller Spiele, Spaß und guter Gespräche...",
      status: "planned", tagIds: ["t8"],
      participants: [{ participantId: "p5", status: "yes" }, { participantId: "p7", status: "yes" }, { participantId: "p9", status: "maybe" }, { participantId: "p11", status: "yes" }]
    },
    {
      id: "e7", title: "Hackathon Kickoff", date: "2026-06-20", time: "10:00",
      location: "Innovation Hub", description: "Der Startschuss für ein kreatives Wochenende voller Innovation...",
      status: "planned", tagIds: ["t2", "t4", "t5"],
      participants: [{ participantId: "p1", status: "yes" }, { participantId: "p2", status: "maybe" }, { participantId: "p4", status: "yes" }, { participantId: "p12", status: "yes" }]
    },
    {
      id: "e8", title: "Sommer Grillabend", date: "2026-07-11", time: "17:00",
      location: "FH Innenhof", description: "Genieße einen entspannten Sommerabend mit Grillstationen und Musik...",
      status: "planned", tagIds: ["t1", "t7", "t8"],
      participants: [{ participantId: "p3", status: "yes" }, { participantId: "p5", status: "yes" }, { participantId: "p8", status: "maybe" }, { participantId: "p10", status: "yes" }]
    },
    {
      id: "e9", title: "Career Talk", date: "2026-01-25", time: "16:30",
      location: "Audimax", description: "Unternehmen geben Einblicke in Bewerbung und Karrierewege...",
      status: "completed", tagIds: ["t4", "t5"],
      participants: [{ participantId: "p2", status: "yes" }, { participantId: "p6", status: "yes" }, { participantId: "p7", status: "yes" }, { participantId: "p11", status: "maybe" }]
    },
    {
      id: "e10", title: "Fotowalk Altstadt", date: "2026-02-08", time: "14:00",
      location: "Hauptplatz", description: "Erkunde die Altstadt gemeinsam aus fotografischer Perspektive...",
      status: "completed", tagIds: ["t6", "t7"],
      participants: [{ participantId: "p1", status: "yes" }, { participantId: "p4", status: "yes" }, { participantId: "p9", status: "yes" }, { participantId: "p12", status: "no" }]
    }
  ]
};

const DEFAULT_SEED_URL = "data/eventbuddy-data.json";

export class SeedDataRepository {
  // Lädt Daten prioritär via Fetch
  async load(url = DEFAULT_SEED_URL) {
    const isFileProtocol = typeof window !== "undefined" && window.location?.protocol === "file:";
    
    // Cache-Busting: Timestamp verhindert Browser-Caching
    const requestUrl = isFileProtocol
      ? url
      : `${url}${url.includes("?") ? "&" : "?"}_ts=${Date.now()}`;

    try {
      const response = await fetch(requestUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      return await response.json();
    } catch (error) {
      // Fallback 1: XHR für lokale Dateisysteme
      const fallbackFromXhr = await tryLoadSeedViaXhr(url);
      if (fallbackFromXhr) return fallbackFromXhr;

      // Fallback 2: Hardcoded Daten bei Totalausfall
      console.warn("Nutze Hardcoded Fallback Seed:", error.message);
      return FALLBACK_SEED;
    }
  }
}

// Sekundärer Ladeweg (robuster bei file://)
function tryLoadSeedViaXhr(url) {
  if (typeof window === "undefined" || typeof XMLHttpRequest === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = new XMLHttpRequest();
      request.open("GET", url, true);

      request.onload = () => {
        const isLocalFile = window.location?.protocol === "file:";
        const isOk = request.status === 200 || (isLocalFile && request.status === 0);
        if (!isOk) return resolve(null);

        try {
          resolve(JSON.parse(request.responseText));
        } catch (e) {
          resolve(null);
        }
      };

      request.onerror = () => resolve(null);
      request.send(null);
    } catch (error) {
      resolve(null);
    }
  });
}