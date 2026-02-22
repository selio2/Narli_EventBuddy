import { ValidationError } from "../model/event-buddy-model.js";

const MOBILE_LAYOUT_MAX_WIDTH = 767;

/* --- Helper für Datenbereinigung --- */
function normalizeText(value) {
  return String(value ?? "").trim();
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

export class AppController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
    this.ui = { modal: null }; // UI-spezifischer State (Modals, Feedback), kein Model-State
  }

  // Initialisierung: Verknüpft View-Events mit Controller-Aktionen
  init() {
    this.view.addEventListener("ui-action", (event) => {
      const { type, payload } = event.detail;
      this._handleAction(type, payload ?? {});
    });

    // Binding: View wird bei jeder Datenänderung im Model aktualisiert
    if (typeof this.view.connectModel === "function") {
      this.view.connectModel(this.model, () => this.ui);
    } else {
      this.model.addEventListener("statechange", (event) => {
        this.view.update(event.detail, this.ui);
      });
    }

    this._setMobileDetailView(false);
    this.model.emitState();
  }

  _render() {
    this.view.update(this.model.getSnapshot(), this.ui);
  }

  /* --- UI-Zustandssteuerung --- */
  _setModal(modal) {
    this.ui.modal = modal;
    this._render();
  }

  _closeModal() {
    this.ui.modal = this.ui.modal?.parentModal ?? null; // Schließt aktuelles Modal, kehrt ggf. zum vorherigen zurück
    this._render();
  }

  _showFeedback(message, title = "Hinweis", parentModal = null) {
    this._setModal({ type: "feedback", title, message, parentModal });
  }

  /* --- Formular- & Manager-Öffner --- */
  _openEventForm(mode, eventItem = null, values = null, errors = {}) {
    const defaults = {
      title: eventItem?.title ?? "",
      date: eventItem?.date ?? "",
      time: eventItem?.time ?? "",
      endTime: eventItem?.endTime ?? "",
      location: eventItem?.location ?? "",
      status: eventItem?.status ?? "planned",
      description: eventItem?.description ?? "",
      tagIds: [...(eventItem?.tagIds ?? [])]
    };

    this._setModal({
      type: "event-form",
      mode,
      eventId: eventItem?.id ?? "",
      values: values ? { ...defaults, ...values } : defaults,
      errors
    });
  }

  _openTagManager() {
    const state = this.model.getSnapshot();
    const rows = state.tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      draftName: tag.name, // Arbeitskopie für Inline-Editing
      isNew: false,
      isEditing: false,
      deleted: false
    }));

    this._setModal({ type: "tag-manager", query: "", rows, error: "" });
  }

  _openInviteModal(eventId) {
    this._setModal({ type: "invite", eventId, query: "", selectedIds: [] });
  }

  /* --- Bestätigungs-Dialoge --- */
  _openDeleteConfirm(targetId) {
    this._setModal({
      type: "confirm",
      targetId,
      title: "Event wirklich löschen?",
      message: "Diese Aktion kann nicht rückgängig gemacht werden.",
      confirmLabel: "Event löschen",
      confirmAction: "confirm-delete-event"
    });
  }

  _openParticipantRemoveConfirm(eventId, participantId) {
    const state = this.model.getSnapshot();
    const eventItem = state.events.find((item) => item.id === eventId);
    const participant = state.participants.find((item) => item.id === participantId);

    const participantName = normalizeText(participant?.nickname || `${participant?.firstName ?? ""} ${participant?.lastName ?? ""}`) || "diese Person";
    const eventContext = eventItem ? `"${normalizeText(eventItem.title) || "Event"}"` : "diesem Event";

    this._setModal({
      type: "confirm",
      title: "Teilnehmer wirklich entfernen?",
      message: `Möchtest du "${participantName}" aus ${eventContext} entfernen?`,
      confirmLabel: "Entfernen",
      confirmAction: "confirm-unassign-participant",
      eventId,
      participantId
    });
  }

  _openTagDeleteConfirm(rowId) {
    const currentModal = this.ui.modal;
    if (!currentModal || currentModal.type !== "tag-manager") return;

    const row = currentModal.rows.find((item) => item.id === rowId);
    if (!row) return;

    const parentModal = { ...currentModal, rows: currentModal.rows.map((item) => ({ ...item })) };
    const tagName = normalizeText(row.name || row.draftName) || "dieser Tag";

    this._setModal({
      type: "confirm",
      targetId: rowId,
      title: "Tag wirklich löschen?",
      message: `Möchtest du "${tagName}" wirklich löschen?`,
      confirmLabel: "Tag löschen",
      confirmAction: "confirm-delete-tag",
      parentModal
    });
  }

  /* --- Hilfsmethoden für Validierung & Logik --- */
  _getTagUsageCount(tagId) {
    const state = this.model.getSnapshot();
    return state.events.filter((eventItem) => eventItem.tagIds.includes(tagId)).length;
  }

  _getActiveTagEditRowId(modal = this.ui.modal) {
    if (!modal || modal.type !== "tag-manager") return "";
    return modal.rows?.find((item) => !item.deleted && item.isEditing)?.id ?? "";
  }

  _tagNameExistsInModal(name, excludeRowId = "", modal = this.ui.modal) {
    if (!modal || modal.type !== "tag-manager") return false;
    const normalized = normalizeText(name).toLowerCase();
    return (modal.rows ?? []).some((row) => {
      if (row.deleted || row.id === excludeRowId) return false;
      const candidate = normalizeText(row.isEditing ? row.draftName : row.name).toLowerCase();
      return candidate === normalized;
    });
  }

  /* --- Layout & Responsivität --- */
  _setMobileDetailView(showDetail) {
    if (typeof document === "undefined") return;
    const isMobile = typeof window !== "undefined" && window.matchMedia(`(max-width: ${MOBILE_LAYOUT_MAX_WIDTH}px)`).matches;
    
    // Klasse "is-detail" am Body triggert CSS-Layout-Wechsel für Mobilgeräte
    document.body.classList.toggle("is-detail", Boolean(showDetail) && isMobile);
    this._closeMobileFilters();
  }

  _closeMobileFilters() {
    const filterToggle = document.querySelector("#mobile-filters-toggle");
    if (filterToggle instanceof HTMLInputElement) filterToggle.checked = false;
  }

  /* --- Zentraler Dispatcher für UI-Aktionen --- */
  _handleAction(type, payload) {
    try {
      switch (type) {
        // Event Management
        case "open-create-event":
        case "open-create-by-view": this._openEventForm("create"); break;
        case "open-edit-event-modal": {
          const state = this.model.getSnapshot();
          const eventId = payload.eventId || state.selectedEventId;
          const eventItem = state.events.find((item) => item.id === eventId);
          if (eventItem) this._openEventForm("edit", eventItem);
          break;
        }
        case "request-delete-event": this._openDeleteConfirm(payload.eventId); break;
        case "confirm-delete-event": {
          this.model.deleteEvent(payload.targetId);
          this._closeModal();
          break;
        }

        // Navigation & Filter
        case "select-event": {
          this.model.selectEvent(payload.eventId);
          this._setMobileDetailView(true);
          break;
        }
        case "show-list-view": this._setMobileDetailView(false); break;
        case "set-event-query": this.model.setEventFilter("query", payload.value ?? ""); break;
        case "clear-event-query": this.model.setEventFilter("query", ""); break;
        case "set-tag-filter": this.model.setEventFilter("tagId", payload.value ?? "all"); break;
        case "set-participant-filter": this.model.setEventFilter("participantId", payload.value ?? "all"); break;
        case "set-status-filter": this.model.setEventFilter("status", payload.status ?? "planned"); break;
        case "apply-mobile-filters": {
          const v = payload.values ?? {};
          this.model.setEventFilter("tagId", v.tagId ?? "all");
          this.model.setEventFilter("participantId", v.participantId ?? "all");
          this.model.setEventFilter("status", v.status ?? "planned");
          this._closeMobileFilters();
          break;
        }

        // Einladungen
        case "open-invite-modal": {
          const eventId = payload.eventId || this.model.getSnapshot().selectedEventId;
          if (eventId) this._openInviteModal(eventId);
          break;
        }
        case "invite-query": {
          if (this.ui.modal?.type === "invite") { this.ui.modal.query = payload.value ?? ""; this._render(); }
          break;
        }
        case "toggle-invite-selection": {
          if (this.ui.modal?.type !== "invite") return;
          const selected = new Set(this.ui.modal.selectedIds ?? []);
          payload.checked ? selected.add(payload.participantId) : selected.delete(payload.participantId);
          this.ui.modal.selectedIds = [...selected];
          this._render();
          break;
        }
        case "save-invite-modal": {
          this.model.assignParticipantsToEvent(this.ui.modal.eventId, this.ui.modal.selectedIds ?? []);
          this._showFeedback("Einladungen verschickt.", "Erfolg");
          break;
        }

        // Teilnehmer Management
        case "unassign-participant": this._openParticipantRemoveConfirm(payload.eventId, payload.participantId); break;
        case "confirm-unassign-participant": {
          const eid = payload.eventId ?? this.ui.modal?.eventId;
          const pid = payload.participantId ?? this.ui.modal?.participantId;
          this._closeModal();
          this.model.removeParticipantFromEvent(eid, pid);
          break;
        }
        case "set-participant-status": {
          this.model.updateParticipantStatus(payload.eventId, payload.participantId, normalizeText(payload.value).toLowerCase());
          break;
        }

        // Tag Manager Aktionen
        case "open-tag-manager": this._openTagManager(); break;
        case "tag-query": {
          if (this.ui.modal?.type === "tag-manager" && !this._getActiveTagEditRowId()) {
            this.ui.modal.query = payload.value ?? ""; this._render();
          }
          break;
        }
        case "tag-row-add": {
          if (this.ui.modal?.type !== "tag-manager" || this._getActiveTagEditRowId()) return;
          const rowId = `tmp_${Date.now()}`;
          this.ui.modal.rows.unshift({ id: rowId, name: "", draftName: "", isNew: true, isEditing: true, deleted: false });
          this.ui.modal.focusRowId = rowId;
          this.ui.modal.focusInputAction = "tag-row-draft-name";
          this._render();
          break;
        }
        case "tag-row-remove": this._openTagDeleteConfirm(payload.rowId); break;
        case "confirm-delete-tag": {
          const parent = this.ui.modal.parentModal;
          const row = parent.rows.find(r => r.id === this.ui.modal.targetId);
          if (row.isNew) { parent.rows = parent.rows.filter(r => r.id !== row.id); }
          else {
            const count = this._getTagUsageCount(row.id);
            if (count > 0) return this._showFeedback(`Tag wird in ${count} Events genutzt.`, "Fehler", parent);
            row.deleted = true;
          }
          this._setModal(parent);
          break;
        }
        case "tag-row-start-edit": {
          const row = this.ui.modal.rows.find(r => r.id === payload.rowId);
          if (row) { row.isEditing = true; row.draftName = row.name; this.ui.modal.focusRowId = row.id; this._render(); }
          break;
        }
        case "tag-row-draft-name": {
          const row = this.ui.modal.rows.find(r => r.id === payload.rowId);
          if (row) { row.draftName = payload.value ?? ""; this._render(); }
          break;
        }
        case "tag-row-commit-edit": {
          const row = this.ui.modal.rows.find(r => r.id === payload.rowId);
          const name = normalizeText(row.draftName);
          if (!name) { this.ui.modal.error = "Name leer."; this._render(); return; }
          if (this._tagNameExistsInModal(name, row.id)) { this.ui.modal.error = "Name existiert."; this._render(); return; }
          row.name = name; row.isEditing = false; this._render();
          break;
        }
        case "save-tag-manager": this._saveTagManager(); break;
        case "save-event-form": this._saveEventForm(payload); break;
        case "close-modal": this._closeModal(); break;
      }
    } catch (error) {
      this._showFeedback(error.message || "Unerwarteter Fehler.", "Fehler");
    }
  }

  /* --- Persistierung (Model-Schnittstelle) --- */
  _saveEventForm(payload) {
    const v = payload.values ?? {};
    const data = {
      title: normalizeText(v.title),
      date: normalizeText(v.date),
      time: normalizeText(v.time),
      endTime: normalizeText(v.endTime),
      location: normalizeText(v.location),
      status: normalizeText(v.status) || "planned",
      description: normalizeText(v.description),
      tagIds: toArray(v.tagIds)
    };

    try {
      payload.mode === "edit" ? this.model.updateEvent(payload.eventId, data) : this.model.createEvent(data);
      this._closeModal();
    } catch (e) {
      if (e instanceof ValidationError) this._openEventForm(payload.mode, null, data, e.errors);
      else throw e;
    }
  }

  _saveTagManager() {
    const modal = this.ui.modal;
    const state = this.model.getSnapshot();
    try {
      // Löschen & Umbenennen
      state.tags.forEach(tag => {
        const row = modal.rows.find(r => r.id === tag.id);
        if (!row || row.deleted) this.model.deleteTag(tag.id);
        else if (normalizeText(row.name) !== tag.name) this.model.renameTag(tag.id, row.name);
      });
      // Neu erstellen
      modal.rows.filter(r => r.isNew && !r.deleted).forEach(r => {
        if (normalizeText(r.name)) this.model.createTag(r.name);
      });
      this._closeModal();
    } catch (e) {
      this.ui.modal.error = e.message; this._render();
    }
  }
}