// Datenmodell der Anwendung (Single Source of Truth für Events, Tags, Teilnehmer und Filter).
// Der Controller ruft Methoden auf, das Model validiert/aktualisiert und meldet danach statechange-Events.
import { SeedDataRepository } from "./seed-loader.js";

/* --- Konfiguration & Konstanten --- */
const EVENT_STATUSES = ["planned", "completed"];
const PARTICIPANT_RESPONSE_STATUSES = ["yes", "maybe", "no"];
const DEFAULT_SEED_URL = "data/eventbuddy-data.json";

/* --- Utility Funktionen (Pure Functions) --- */

// Erzeugt tiefe Kopien, damit die View den internen Zustand nicht versehentlich manipuliert
function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

// Zeit-Logik: Wandelt HH:MM in absolute Minuten um für Vergleiche
function parseTimeToMinutes(value) {
  const normalized = normalizeText(value);
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(normalized);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatMinutesToTime(totalMinutes) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

// Berechnet automatisch eine Endzeit (Standard +2h), falls keine angegeben wurde
function deriveEndTime(startTime, endTime = "") {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  if (startMinutes !== null && endMinutes !== null && endMinutes > startMinutes) return normalizeText(endTime);
  if (startMinutes === null) return normalizeText(endTime);
  return formatMinutesToTime(startMinutes + 120);
}

/* --- Such-Logik --- */

function toSearchWords(value) {
  return String(value ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean);
}

function toTextWords(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

// Prüft, ob alle Suchbegriffe als Präfixe in den Zielwörtern vorkommen (Fuzzy Search)
function matchesSearchWords(text, query) {
  const queryWords = toSearchWords(query);
  if (queryWords.length === 0) return true;
  const textWords = toTextWords(text);
  if (textWords.length === 0) return false;
  return queryWords.every((qW) => textWords.some((tW) => tW.startsWith(qW)));
}

function normalizeParticipantStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === "assigned") return "maybe";
  return PARTICIPANT_RESPONSE_STATUSES.includes(normalized) ? normalized : "maybe";
}

function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

/* --- Fehlerklassen --- */

export class ValidationError extends Error {
  constructor(message, errors = {}) {
    super(message);
    this.name = "ValidationError";
    this.errors = errors; // Enthält feldbezogene Fehlermeldungen für die UI
  }
}

/* --- Hauptklasse: EventBuddyModel --- */

export class EventBuddyModel extends EventTarget {
  // Factory-Methode zum asynchronen Laden der JSON-Daten
  static async create({ repository = new SeedDataRepository(), seedUrl = DEFAULT_SEED_URL } = {}) {
    const seed = await repository.load(seedUrl);
    return new EventBuddyModel(seed);
  }

  constructor(seed) {
    super();
    const safeSeed = seed ?? {};

    // Normalisierung des Initialzustands
    const events = (safeSeed.events ?? []).map((ev) => ({
      ...ev,
      endTime: deriveEndTime(ev.time, ev.endTime),
      tagIds: [...(ev.tagIds ?? [])],
      participants: (ev.participants ?? []).map((p) => ({
        ...p,
        status: normalizeParticipantStatus(p.status)
      }))
    }));

    this._state = {
      users: (safeSeed.users ?? []).map(u => ({ ...u })),
      currentUserId: safeSeed.currentUserId ?? safeSeed.users?.[0]?.id ?? null,
      tags: (safeSeed.tags ?? []).map(t => ({ ...t })),
      participants: (safeSeed.participants ?? []).map(p => ({ ...p })),
      events,
      eventFilters: { query: "", tagId: "all", participantId: "all", status: "planned" },
      selectedEventId: events[0]?.id ?? null
    };

    this._ensureSelectionIntegrity();
  }

  // Liefert der View ein komplettes, entkoppeltes Abbild des aktuellen Zustands
  getSnapshot() {
    const state = this._state;
    const filteredEvents = this._getFilteredEvents();
    const selectedEvent = filteredEvents.find(ev => ev.id === state.selectedEventId) ?? filteredEvents[0] ?? null;

    return {
      users: deepClone(state.users),
      currentUser: deepClone(state.users.find(u => u.id === state.currentUserId) ?? null),
      tags: deepClone(state.tags),
      participants: deepClone(state.participants),
      events: deepClone(state.events),
      eventFilters: { ...state.eventFilters },
      selectedEventId: selectedEvent?.id ?? null,
      selectedEvent: selectedEvent ? deepClone(selectedEvent) : null,
      filteredEvents: deepClone(filteredEvents)
    };
  }

  emitState() {
    this.dispatchEvent(new CustomEvent("statechange", { detail: this.getSnapshot() }));
  }

  /* --- Mutationen (Zustandsänderungen) --- */

  selectEvent(eventId) {
    if (!this._findEvent(eventId)) return;
    this._state.selectedEventId = eventId;
    this.emitState();
  }

  setEventFilter(name, value) {
    if (!(name in this._state.eventFilters)) return;
    this._state.eventFilters[name] = value;
    this._ensureSelectionIntegrity(); // Verhindert, dass ein ausgefiltertes Event selektiert bleibt
    this.emitState();
  }

  /* --- Event-CRUD --- */

  createEvent(input) {
    const normalized = this._validateEventInput(input);
    const eventItem = { id: createId("event"), ...normalized, participants: [] };
    this._state.events.unshift(eventItem);
    this._state.selectedEventId = eventItem.id;
    this.emitState();
    return deepClone(eventItem);
  }

  updateEvent(eventId, input) {
    const eventItem = this._findEvent(eventId);
    if (!eventItem) throw new Error("Event nicht gefunden.");

    const normalized = this._validateEventInput(input);
    Object.assign(eventItem, normalized); // Alle validierten Felder übernehmen

    this.emitState();
    return deepClone(eventItem);
  }

  deleteEvent(eventId) {
    const index = this._state.events.findIndex(ev => ev.id === eventId);
    if (index === -1) throw new Error("Event nicht gefunden.");
    this._state.events.splice(index, 1);
    this._ensureSelectionIntegrity();
    this.emitState();
  }

  /* --- Tag-Management --- */

  createTag(name) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) throw new ValidationError("Tagname fehlt.", { tag: "Tagname ist erforderlich." });
    if (this._tagNameExists(normalizedName)) throw new ValidationError("Existiert bereits.", { tag: "Tagname existiert bereits." });

    const tag = { id: createId("tag"), name: normalizedName };
    this._state.tags.push(tag);
    this.emitState();
    return deepClone(tag);
  }

  renameTag(tagId, newName) {
    const tag = this._findTag(tagId);
    if (!tag) throw new Error("Tag nicht gefunden.");
    const normalized = normalizeText(newName);
    if (!normalized) throw new ValidationError("Name leer.", { tag: "Tagname erforderlich." });
    if (this._tagNameExists(normalized, tagId)) throw new ValidationError("Existiert.", { tag: "Name existiert bereits." });

    tag.name = normalized;
    this.emitState();
  }

  deleteTag(tagId) {
    const idx = this._state.tags.findIndex(t => t.id === tagId);
    if (idx === -1) throw new Error("Tag nicht gefunden.");
    
    // Verhindert das Löschen von Tags, die noch in Events verwendet werden
    const usage = this._state.events.filter(ev => ev.tagIds.includes(tagId)).length;
    if (usage > 0) {
      throw new ValidationError("In Verwendung.", { tag: `Wird noch in ${usage} Event(s) genutzt.` });
    }

    this._state.tags.splice(idx, 1);
    this.emitState();
  }

  /* --- Teilnehmer-Logik --- */

  assignParticipantsToEvent(eventId, participantIds) {
    const eventItem = this._findEvent(eventId);
    if (!eventItem) throw new Error("Event nicht gefunden.");

    const validIds = [...new Set(participantIds)].filter(id => this._findParticipant(id));
    validIds.forEach(pId => {
      if (!eventItem.participants.some(a => a.participantId === pId)) {
        eventItem.participants.push({ participantId: pId, status: "maybe" });
      }
    });
    this.emitState();
  }

  updateParticipantStatus(eventId, participantId, status) {
    const eventItem = this._findEvent(eventId);
    const assignment = eventItem?.participants.find(p => p.participantId === participantId);
    if (!assignment) throw new Error("Zuordnung nicht gefunden.");
    assignment.status = normalizeParticipantStatus(status);
    this.emitState();
  }

  removeParticipantFromEvent(eventId, participantId) {
    const eventItem = this._findEvent(eventId);
    if (eventItem) {
      eventItem.participants = eventItem.participants.filter(a => a.participantId !== participantId);
      this.emitState();
    }
  }

  /* --- Interne Validierung & Filterung --- */

  _validateEventInput(input) {
    const errors = {};
    const title = normalizeText(input.title);
    const date = normalizeText(input.date);
    const time = normalizeText(input.time);
    const endTime = normalizeText(input.endTime);
    const status = normalizeText(input.status).toLowerCase();
    
    // Felder-Check
    if (!title) errors.title = "Titel ist ein Pflichtfeld.";
    if (!date) errors.date = "Datum ist ein Pflichtfeld.";
    if (!time) errors.time = "Uhrzeit ist ein Pflichtfeld.";
    if (!endTime) errors.endTime = "Endzeit ist ein Pflichtfeld.";
    if (!normalizeText(input.location)) errors.location = "Ort ist ein Pflichtfeld.";
    if (!normalizeText(input.description)) errors.description = "Beschreibung ist ein Pflichtfeld.";
    
    // Logik-Check: Zeitfluss
    const startM = parseTimeToMinutes(time);
    const endM = parseTimeToMinutes(endTime);
    if (startM !== null && endM !== null && endM <= startM) {
      errors.endTime = "Endzeit muss nach der Startzeit liegen.";
    }

    if (Object.keys(errors).length > 0) throw new ValidationError("Validierungsfehler", errors);

    return {
      title, date, time, endTime,
      location: normalizeText(input.location),
      description: normalizeText(input.description),
      status: EVENT_STATUSES.includes(status) ? status : "planned",
      tagIds: [...new Set(input.tagIds ?? [])].filter(id => this._findTag(id))
    };
  }

  _getFilteredEvents() {
    const f = this._state.eventFilters;
    let items = [...this._state.events];

    if (f.query) items = items.filter(ev => matchesSearchWords(ev.title, f.query));
    if (f.status !== "all") items = items.filter(ev => ev.status === f.status);
    if (f.tagId !== "all") items = items.filter(ev => ev.tagIds.includes(f.tagId));
    if (f.participantId !== "all") {
      items = items.filter(ev => ev.participants.some(a => a.participantId === f.participantId));
    }

    // Chronologische Sortierung: Datum -> Zeit
    return items.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }

  // Stellt sicher, dass immer ein gültiges Event selektiert ist (falls vorhanden)
  _ensureSelectionIntegrity() {
    const filtered = this._getFilteredEvents();
    if (filtered.length === 0) {
      this._state.selectedEventId = null;
    } else if (!filtered.some(ev => ev.id === this._state.selectedEventId)) {
      this._state.selectedEventId = filtered[0].id;
    }
  }

  /* --- Helper-Finder --- */
  _findEvent(id) { return this._state.events.find(ev => ev.id === id) ?? null; }
  _findParticipant(id) { return this._state.participants.find(p => p.id === id) ?? null; }
  _findTag(id) { return this._state.tags.find(t => t.id === id) ?? null; }
  _tagNameExists(name, excludeId = "") {
    const norm = name.toLowerCase();
    return this._state.tags.some(t => t.id !== excludeId && t.name.toLowerCase() === norm);
  }
}