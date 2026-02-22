// Web-Component der App: rendert Sidebar, Detailansicht und Modals aus dem uebergebenen Snapshot.
// Die View ist zustandslos bzgl Datenlogik und emittiert nur UI-Aktionen an den Controller.
// Anzeige-Labels und Konstanten fuer UI-Rendering.
const EVENT_STATUS_LABELS = {
  planned: "GEPLANT",
  completed: "ABGESCHLOSSEN"
};

const PARTICIPANT_STATUS_LABELS = {
  yes: "Zugesagt",
  maybe: "Unentschlossen",
  no: "Abgesagt"
};

const MONTH_SHORT = ["JAN", "FEB", "MÄR", "APR", "MAI", "JUN", "JUL", "AUG", "SEP", "OKT", "NOV", "DEZ"];
const MONTH_LONG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

// Escaping-Helfer sichere String-Ausgabe in Template-Strings.
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Datumsformatierung Badge- und Detaildarstellung.
function getDateParts(dateString) {
  const parts = String(dateString ?? "").split("-");
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month, day };
}

function formatDateBadge(dateString) {
  const parts = getDateParts(dateString);
  if (!parts) return { day: "--", month: "---" };
  return {
    day: String(parts.day).padStart(2, "0"),
    month: MONTH_SHORT[parts.month - 1]
  };
}

function formatDateLong(dateString, timeString = "", endTimeString = "") {
  const parts = getDateParts(dateString);
  if (!parts) return "-";
  const startTime = String(timeString || "").trim();
  const endTime = String(endTimeString || "").trim();
  let timeText = "";

  if (startTime && endTime) {
    timeText = `, ${startTime} - ${endTime} Uhr`;
  } else if (startTime) {
    timeText = `, ${startTime} Uhr`;
  } else if (endTime) {
    timeText = `, bis ${endTime} Uhr`;
  }

  return `${parts.day}. ${MONTH_LONG[parts.month - 1]} ${parts.year}${timeText}`;
}

function formatTimeRange(timeString = "", endTimeString = "") {
  const startTime = String(timeString || "").trim();
  const endTime = String(endTimeString || "").trim();
  if (startTime && endTime) return `${startTime}-${endTime}`;
  return startTime || endTime || "";
}

// Zerlegt Beschreibungen in zwei lesbare Absaetze für die Detailansicht.
function buildDescriptionParagraphs(value) {
  const text = String(value ?? "").replace(/\r/g, "").trim();
  if (!text) return ["", ""];

  const explicitParagraphs = text
    .split(/\n\s*\n+/)
    .map((part) => part.replace(/\s*\n+\s*/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (explicitParagraphs.length >= 2) {
    return [explicitParagraphs[0], explicitParagraphs.slice(1).join(" ")];
  }

  const sentences = (text.match(/[^.!?]+[.!?]*/g) || [])
    .map((part) => part.trim())
    .filter(Boolean);

  if (sentences.length >= 2) {
    const splitAt = Math.ceil(sentences.length / 2);
    return [
      sentences.slice(0, splitAt).join(" "),
      sentences.slice(splitAt).join(" ")
    ];
  }

  return [text, ""];
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function normalizeParticipantStatus(status) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "yes" || normalized === "maybe" || normalized === "no") return normalized;
  return "maybe";
}

function toSearchWords(value) {
  return String(value ?? "").toLowerCase().trim().split(/\s+/).filter(Boolean);
}

function toTextWords(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9\u00C0-\u024F]+/g, " ").trim().split(/\s+/).filter(Boolean);
}

function matchesSearchWords(text, query) {
  const queryWords = toSearchWords(query);
  if (queryWords.length === 0) return true;
  const textWords = toTextWords(text);
  if (textWords.length === 0) return false;
  return queryWords.every((queryWord) => textWords.some((textWord) => textWord.startsWith(queryWord)));
}

// Liefert SVG-Markup: wiederverwendete UI-Icons.
function renderIcon(name) {
  const icons = {
    plus: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    search: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="m21 21-4.3-4.3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    close: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="m18 6-12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="m6 6 12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    edit: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="m15 5 4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    check: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    "chevron-down": `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    trash: `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M10 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    "map-pin": `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M20 10c0 5.2-8 12-8 12s-8-6.8-8-12a8 8 0 1 1 16 0Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `,
    "user-round": `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 21a8 8 0 0 0-16 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `
  };

  return `<span class="ui-icon ui-icon--${name}">${icons[name] ?? ""}</span>`;
}

// Custom Element fuer die gesamte App-Oberfläche.
export class EventBuddyAppView extends HTMLElement {
  constructor() {
    super();
    this.state = null;
    this.ui = { modal: null };
    this._delegatesBound = false;
    this._pendingSearchFocus = null;
    this._model = null;
    this._modelStateListener = null;
    this._uiStateProvider = null;
  }

  // Initialisiert Delegates genau einmal und zeigt vor dem ersten State ein Loading-Geruest.
  connectedCallback() {
    if (!this._delegatesBound) {
      this._bindDelegates();
      this._delegatesBound = true;
    }

    if (!this.state) {
      this.innerHTML = '<div class="shell"><section class="panel detail"><p>Lade EventBuddy...</p></section></div>';
    }
  }

  // Verknüpft die View mit dem Model und verarbeitet dessen statechange-Events direkt.
  connectModel(model, uiStateProvider = () => this.ui) {
    this.disconnectModel();

    if (!model || typeof model.addEventListener !== "function") return;
    this._model = model;
    this._uiStateProvider = typeof uiStateProvider === "function" ? uiStateProvider : () => this.ui;
    this._modelStateListener = (event) => {
      const uiState = this._uiStateProvider?.() ?? this.ui;
      this.update(event.detail, uiState);
    };
    this._model.addEventListener("statechange", this._modelStateListener);
  }

  disconnectModel() {
    if (this._model && this._modelStateListener) {
      this._model.removeEventListener("statechange", this._modelStateListener);
    }
    this._model = null;
    this._modelStateListener = null;
    this._uiStateProvider = null;
  }

  disconnectedCallback() {
    this.disconnectModel();
  }

  // Übernimmt Snapshot + UI-State vom Controller und startet Render.
  update(state, uiState) {
    this.state = state;
    this.ui = uiState ?? { modal: null };
    this.render();
  }

  // Render-Zyklus inkl. Fokus- und Scroll-Erhalt.
  render() {
    if (!this.state) return;
    const focusState = this._captureFocusState();
    const scrollState = this._captureScrollState();

    this.innerHTML = `
      <div class="shell">
        <aside class="panel sidebar">
          ${this._renderSidebar()}
        </aside>
        <section class="panel detail">
          ${this._renderEventDetail()}
        </section>
      </div>
      ${this._renderModal()}
    `;

    this._restoreFocusState(focusState);
    this._applyPendingTagInputFocus(focusState);
    this._applyPendingSearchFocus();
    this._restoreScrollState(scrollState);
  }

  // Merkt den aktuellen Fokus, damit er nach einem Re-Render wiederhergestellt werden kann.
  _captureFocusState() {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !this.contains(active)) return null;

    const state = {
      id: active.getAttribute("id") ?? "",
      rowId: active.getAttribute("data-row-id") ?? "",
      inputAction: active.getAttribute("data-input-action") ?? "",
      changeAction: active.getAttribute("data-change-action") ?? "",
      participantId: active.getAttribute("data-participant-id") ?? ""
    };

    if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
      state.selectionStart = active.selectionStart;
      state.selectionEnd = active.selectionEnd;
    }

    return state;
  }
  _captureScrollState() {
    const sidebarEvents = this.querySelector(".sidebar__events");
    const mobileFiltersToggle = this.querySelector("#mobile-filters-toggle");
    const inviteList = this.querySelector(".invite-list");
    return {
      sidebarEventsScrollTop: sidebarEvents instanceof HTMLElement ? sidebarEvents.scrollTop : 0,
      mobileFiltersOpen: mobileFiltersToggle instanceof HTMLInputElement ? mobileFiltersToggle.checked : false,
      inviteListScrollTop: inviteList instanceof HTMLElement ? inviteList.scrollTop : 0
    };
  }

  _restoreScrollState(scrollState) {
    if (!scrollState) return;
    const mobileFiltersToggle = this.querySelector("#mobile-filters-toggle");
    if (mobileFiltersToggle instanceof HTMLInputElement) {
      mobileFiltersToggle.checked = Boolean(scrollState.mobileFiltersOpen);
    }
    const sidebarEvents = this.querySelector(".sidebar__events");
    if (sidebarEvents instanceof HTMLElement) {
      sidebarEvents.scrollTop = Number(scrollState.sidebarEventsScrollTop ?? 0);
    }
    const inviteList = this.querySelector(".invite-list");
    if (inviteList instanceof HTMLElement) {
      inviteList.scrollTop = Number(scrollState.inviteListScrollTop ?? 0);
    }
  }

  _restoreFocusState(focusState) {
    if (!focusState) return;

    const esc = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    let target = null;

    if (focusState.id) {
      target = this.querySelector(`[id="${esc(focusState.id)}"]`);
    }

    if (!target && focusState.rowId && focusState.inputAction) {
      target = this.querySelector(
        `[data-row-id="${esc(focusState.rowId)}"][data-input-action="${esc(focusState.inputAction)}"]`
      );
    }

    if (!target && focusState.inputAction) {
      target = this.querySelector(`[data-input-action="${esc(focusState.inputAction)}"]`);
    }

    if (!target && focusState.changeAction && focusState.participantId) {
      target = this.querySelector(
        `[data-change-action="${esc(focusState.changeAction)}"][data-participant-id="${esc(focusState.participantId)}"]`
      );
    }

    if (!target && focusState.changeAction) {
      target = this.querySelector(`[data-change-action="${esc(focusState.changeAction)}"]`);
    }

    if (!(target instanceof HTMLElement)) return;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) {
      if (target.disabled) return;
    }
    target.focus();

    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      typeof focusState.selectionStart === "number" &&
      typeof focusState.selectionEnd === "number"
    ) {
      target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
    }
  }

  _applyPendingTagInputFocus(focusState = null) {
    const modal = this.ui?.modal;
    if (!modal || modal.type !== "tag-manager" || !modal.focusRowId) return;

    if (focusState?.inputAction && focusState.inputAction !== "tag-row-draft-name") {
      modal.focusRowId = "";
      modal.focusInputAction = "";
      modal.focusAtEnd = false;
      return;
    }

    const esc = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const inputAction = modal.focusInputAction || "tag-row-draft-name";
    const target = this.querySelector(
      `[data-row-id="${esc(modal.focusRowId)}"][data-input-action="${esc(inputAction)}"]`
    );

    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;

    target.focus();
    const cursor = target.value.length;
    target.setSelectionRange(cursor, cursor);

    modal.focusRowId = "";
    modal.focusInputAction = "";
    modal.focusAtEnd = false;
  }

  _applyPendingSearchFocus() {
    const pending = this._pendingSearchFocus;
    if (!pending) return;

    const esc = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    let target = null;

    if (pending.id) {
      target = this.querySelector(`[id="${esc(pending.id)}"]`);
    }

    if (!target && pending.inputAction) {
      target = this.querySelector(`[data-input-action="${esc(pending.inputAction)}"]`);
    }

    this._pendingSearchFocus = null;

    if (!(target instanceof HTMLInputElement) || target.type !== "search" || target.disabled) return;

    target.focus();
    if (typeof pending.selectionStart === "number" && typeof pending.selectionEnd === "number") {
      target.setSelectionRange(pending.selectionStart, pending.selectionEnd);
    }
  }

  // Delegiert DOM-Events auf data-* Aktionen und emittiert sie als "ui-action".
  _bindDelegates() {

    this.addEventListener("click", (event) => {
      const actionNode = event.target.closest("[data-action]");
      if (!actionNode || !this.contains(actionNode)) {
        return;
      }

      const payload = { ...actionNode.dataset };
      const action = payload.action;
      delete payload.action;
      this._emit(action, payload);
    });

    this.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset?.inputAction;
      if (!action) return;

      if (target instanceof HTMLInputElement && target.type === "search") {
        this._pendingSearchFocus = {
          id: target.id ?? "",
          inputAction: action,
          selectionStart: target.selectionStart,
          selectionEnd: target.selectionEnd
        };
      }

      this._emit(action, {
        ...target.dataset,
        value: target.value
      });
    });

    this.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset?.changeAction;
      if (!action) return;

      const payload = {
        ...target.dataset,
        value: target.value
      };

      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        payload.checked = target.checked;
      }

      this._emit(action, payload);
    });

    this.addEventListener("submit", (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      const action = form.dataset.submitAction;
      if (!action) return;

      event.preventDefault();
      this._emit(action, {
        ...form.dataset,
        values: this._collectFormValues(form)
      });
    });

    this.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this._emit("close-modal", {});
      }
    });
  }

  _collectFormValues(form) {
    const values = {};
    const formData = new FormData(form);

    for (const [key, value] of formData.entries()) {
      if (values[key] === undefined) {
        values[key] = value;
      } else if (Array.isArray(values[key])) {
        values[key].push(value);
      } else {
        values[key] = [values[key], value];
      }
    }

    return values;
  }

  _emit(type, payload) {
    if (!type) return;
    this.dispatchEvent(new CustomEvent("ui-action", {
      bubbles: true,
      composed: true,
      detail: { type, payload }
    }));
  }

  // Rendert linke Spalte: Topbar, Filter, Eventliste und Nutzerbereich.
  _renderSidebar() {
    const { eventFilters } = this.state;
    const currentUserName = this.state.currentUser?.name ?? "Unbekannter User";

    return `
      <div class="sidebar__header">
        <input class="filters-sheet__toggle" id="mobile-filters-toggle" type="checkbox" aria-hidden="true" />
        <div class="mobile-topbar mobile-topbar--sidebar" role="toolbar" aria-label="Event Aktionen">
          <h2 class="mobile-topbar__title">Meine Events</h2>
          <div class="mobile-topbar__actions">
            <button class="mobile-topbar__button mobile-topbar__button--add" type="button" aria-label="Neues Event" data-action="open-create-event">
              ${renderIcon("plus")}
            </button>
            <label class="mobile-topbar__button mobile-topbar__button--filter" for="mobile-filters-toggle" aria-label="Filter anzeigen" aria-controls="mobile-filters-sheet" role="button" tabindex="0">
              <span class="ui-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" focusable="false">
                  <path d="M4 6h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </label>
          </div>
        </div>

        <div class="filters-sheet filters-sheet--mobile" id="mobile-filters-sheet">
          <div class="filters-sheet__body">
            <div class="filters-sheet__head">
              <p class="filters-sheet__title">Filter</p>
            </div>
            ${this._renderMobileEventSidebarFilters()}
          </div>
        </div>

        <div class="tabs" role="tablist" aria-label="Ansicht">
          <button class="tabs__item tabs__item--active" type="button" role="tab" aria-selected="true">Meine Events</button>
          <button class="tabs__add" type="button" aria-label="Neues Event" data-action="open-create-event">${renderIcon("plus")}</button>
        </div>

        <button class="manage-tags" type="button" data-action="open-tag-manager">Tags verwalten</button>

        <form class="search" action="#" method="get" onsubmit="return false;">
          <span class="search__icon" aria-hidden="true">${renderIcon("search")}</span>
          <label class="sr-only" for="sidebar-search">Events suchen</label>
          <input
            id="sidebar-search"
            class="search__input"
            type="search"
            placeholder="Events suchen"
            value="${escapeHtml(eventFilters.query)}"
            data-input-action="set-event-query"
          />
        </form>

        <div class="filters-sheet filters-sheet--desktop">
          ${this._renderEventSidebarFilters()}
        </div>
      </div>

      <div class="sidebar__events">
        ${this._renderEventList()}
      </div>

      <footer class="sidebar-user">
        <span class="sidebar-user__avatar" aria-hidden="true">${renderIcon("user-round")}</span>
        <div>
          <p class="sidebar-user__name">${escapeHtml(currentUserName)}</p>
          <button class="sidebar-user__logout" type="button">Abmelden</button>
        </div>
      </footer>
    `;
  }

  // Desktop-Filterbereich in der Sidebar.
  _renderEventSidebarFilters() {
    const { eventFilters, tags, participants } = this.state;
    return `
      <div class="filter-row">
        <label class="filter-field" for="filter-tag">
          <span class="filter-field__label">Tags</span>
          <select id="filter-tag" class="select-input" data-change-action="set-tag-filter">
            <option value="all" ${eventFilters.tagId === "all" ? "selected" : ""}>Alle</option>
            ${tags.map((tag) => `<option value="${escapeHtml(tag.id)}" ${eventFilters.tagId === tag.id ? "selected" : ""}>${escapeHtml(tag.name)}</option>`).join("")}
          </select>
        </label>

        <label class="filter-field" for="filter-participant">
          <span class="filter-field__label">Teilnehmerinnen</span>
          <select id="filter-participant" class="select-input" data-change-action="set-participant-filter">
            <option value="all" ${eventFilters.participantId === "all" ? "selected" : ""}>Alle</option>
            ${participants.map((participant) => `<option value="${escapeHtml(participant.id)}" ${eventFilters.participantId === participant.id ? "selected" : ""}>${escapeHtml(participant.nickname)}</option>`).join("")}
          </select>
        </label>
      </div>

      <div class="status-switch" role="group" aria-label="Event Status">
        <button class="status-switch__item ${eventFilters.status === "planned" ? "status-switch__item--active" : ""}" type="button" data-action="set-status-filter" data-status="planned">Geplant</button>
        <button class="status-switch__item ${eventFilters.status === "completed" ? "status-switch__item--active" : ""}" type="button" data-action="set-status-filter" data-status="completed">Abgeschlossen</button>
      </div>
    `;
  }

  // Mobile Filteransicht (Sheet).
  _renderMobileEventSidebarFilters() {
    const { eventFilters, tags, participants } = this.state;
    return `
      <div class="filters-sheet__form">
        <div class="filter-row">
          <label class="filter-field" for="mobile-filter-tag">
            <span class="filter-field__label">Tags</span>
            <select id="mobile-filter-tag" class="select-input" data-change-action="set-tag-filter">
              <option value="all" ${eventFilters.tagId === "all" ? "selected" : ""}>Alle</option>
              ${tags.map((tag) => `<option value="${escapeHtml(tag.id)}" ${eventFilters.tagId === tag.id ? "selected" : ""}>${escapeHtml(tag.name)}</option>`).join("")}
            </select>
          </label>

          <label class="filter-field" for="mobile-filter-participant">
            <span class="filter-field__label">Teilnehmerinnen</span>
            <select id="mobile-filter-participant" class="select-input" data-change-action="set-participant-filter">
              <option value="all" ${eventFilters.participantId === "all" ? "selected" : ""}>Alle</option>
              ${participants.map((participant) => `<option value="${escapeHtml(participant.id)}" ${eventFilters.participantId === participant.id ? "selected" : ""}>${escapeHtml(participant.nickname)}</option>`).join("")}
            </select>
          </label>
        </div>

        <div class="status-switch" role="group" aria-label="Event Status">
          <button class="status-switch__item ${eventFilters.status === "planned" ? "status-switch__item--active" : ""}" type="button" data-action="set-status-filter" data-status="planned">Geplant</button>
          <button class="status-switch__item ${eventFilters.status === "completed" ? "status-switch__item--active" : ""}" type="button" data-action="set-status-filter" data-status="completed">Abgeschlossen</button>
        </div>
      </div>
    `;
  }

  // Rendert die gefilterte Eventliste inkl. aktivem Eintrag.
  _renderEventList() {
    const selectedEventId = this.state.selectedEventId;

    if (this.state.filteredEvents.length === 0) {
      return '<div class="sidebar-empty">Keine Events gefunden.</div>';
    }

    return `
      <ul class="event-list" role="list">
        ${this.state.filteredEvents.map((eventItem) => {
          const badge = formatDateBadge(eventItem.date);
          const timeRange = formatTimeRange(eventItem.time, eventItem.endTime);
          const placeLine = timeRange
            ? `${eventItem.location} • ${timeRange}`
            : eventItem.location;
          return `
          <li role="listitem">
            <button
              type="button"
              class="event-entry event-entry--${escapeHtml(eventItem.status)} ${selectedEventId === eventItem.id ? "event-entry--active" : ""}"
              data-action="select-event"
              data-event-id="${escapeHtml(eventItem.id)}"
            >
              <span class="event-entry__date" aria-hidden="true">
                <span class="event-entry__day">${escapeHtml(badge.day)}</span>
                <span class="event-entry__month">${escapeHtml(badge.month)}</span>
              </span>
              <span class="event-entry__meta">
                <span class="event-entry__title">${escapeHtml(eventItem.title)}</span>
                <span class="event-entry__place">${escapeHtml(placeLine)}</span>
              </span>
              <span class="event-entry__indicator" aria-hidden="true"></span>
            </button>
          </li>
        `;
        }).join("")}
      </ul>
    `;
  }

  _getTagPalette(tagId) {
    const source = String(tagId ?? "");
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
    }

    const hue = (hash * 137) % 360;
    const saturation = 62 + ((hash >>> 3) % 10);
    const lightness = 86 + ((hash >>> 7) % 7);

    return {
      background: `hsl(${hue} ${saturation}% ${lightness}%)`,
      border: `hsl(${hue} ${Math.max(36, saturation - 18)}% ${Math.max(72, lightness - 14)}%)`,
      text: `hsl(${hue} 48% 18%)`
    };
  }

  _renderTagPill(name, tagId = "") {
    if (!tagId) {
      return `<span class="tag-pill">${escapeHtml(name)}</span>`;
    }

    const palette = this._getTagPalette(tagId);
    return `<span class="tag-pill" style="background:${palette.background};border-color:${palette.border};color:${palette.text};">${escapeHtml(name)}</span>`;
  }
  // Rendert die Detailansicht eines ausgewählten Events.
  _renderEventDetail() {
    const eventItem = this.state.selectedEvent;
    if (!eventItem) {
      return `
        <div class="detail-mobile-topbar">
          <button class="detail-mobile-back" type="button" aria-label="Zurueck zur Eventliste" data-action="show-list-view">Zurück</button>
        </div>
        <div class="detail-empty">Bitte waehle ein Event aus.</div>
      `;
    }

    const tagLookup = new Map(this.state.tags.map((tag) => [tag.id, tag]));
    const participantLookup = new Map(this.state.participants.map((participant) => [participant.id, participant]));

    const eventTags = eventItem.tagIds
      .map((tagId) => tagLookup.get(tagId))
      .filter(Boolean);

    const assignedParticipants = eventItem.participants
      .map((assignment) => ({
        assignment,
        participant: participantLookup.get(assignment.participantId),
        status: normalizeParticipantStatus(assignment.status)
      }))
      .filter((item) => item.participant);
    const [descriptionLead, descriptionTail] = buildDescriptionParagraphs(eventItem.description);
    const locationText = String(eventItem.location ?? "").trim();

    return `
      <div class="detail-mobile-topbar">
        <button class="detail-mobile-back" type="button" aria-label="Zurueck zur Eventliste" data-action="show-list-view">Zurück</button>
      </div>

      <div class="detail__top">
        <div class="detail__meta">
          <span class="status-chip status-chip--${escapeHtml(eventItem.status)}">${escapeHtml(EVENT_STATUS_LABELS[eventItem.status] ?? "Status")}</span>
          <span class="detail__date">${escapeHtml(formatDateLong(eventItem.date, eventItem.time, eventItem.endTime))}</span>
          ${locationText
            ? `<span class="detail__location"><span aria-hidden="true">${renderIcon("map-pin")}</span><span class="detail__location-text">${escapeHtml(locationText)}</span></span>`
            : ""}
        </div>

        <div class="detail__tools" aria-label="Event Aktionen">
          <button class="icon-btn icon-btn--edit" type="button" aria-label="Bearbeiten" data-action="open-edit-event-modal" data-event-id="${escapeHtml(eventItem.id)}">${renderIcon("edit")}</button>
          <button class="icon-btn icon-btn--delete" type="button" aria-label="Loeschen" data-action="request-delete-event" data-event-id="${escapeHtml(eventItem.id)}">${renderIcon("trash")}</button>
        </div>
      </div>

      <h1 class="detail__title">${escapeHtml(eventItem.title)}</h1>
      <div class="detail__description">
        <p>${escapeHtml(descriptionLead)}</p>
        ${descriptionTail ? `<p>${escapeHtml(descriptionTail)}</p>` : ""}
      </div>

      <div class="tag-row" aria-label="Event Tags">
        ${eventTags.length > 0
          ? eventTags.map((tag) => this._renderTagPill(tag.name, tag.id)).join("")
          : this._renderTagPill("Keine Tags")}
      </div>

      <hr class="detail-divider" />

      <section class="participants" aria-labelledby="participants-title">
        <div class="participants__head">
          <h2 id="participants-title" class="participants__title">TeilnehmerInnen</h2>
          <button class="invite-link" type="button" data-action="open-invite-modal" data-event-id="${escapeHtml(eventItem.id)}"><span aria-hidden="true">${renderIcon("plus")}</span> Einladen</button>
        </div>

        <div class="participant-grid">
          ${assignedParticipants.length > 0
            ? assignedParticipants.map(({ participant, status }) => `
              <article class="participant-card">
                <span class="participant-card__avatar" aria-hidden="true">${renderIcon("user-round")}</span>
                <div class="participant-card__meta">
                  <h3 class="participant-card__name">${escapeHtml(participant.nickname)}</h3>
                  <span class="sr-only">Teilnahmestatus</span>
                  <span class="participant-card__status-wrap">
                    <span class="participant-card__status-text participant-card__status-text--${escapeHtml(status)}">
                      ${escapeHtml(PARTICIPANT_STATUS_LABELS[status] ?? PARTICIPANT_STATUS_LABELS.maybe)}
                    </span>
                    <span class="participant-card__status-trigger" aria-hidden="true">
                      <span class="participant-card__status-caret" aria-hidden="true">${renderIcon("chevron-down")}</span>
                    </span>
                    <select
                      class="participant-card__status-select"
                      aria-label="Teilnahmestatus aendern"
                      data-change-action="set-participant-status"
                      data-event-id="${escapeHtml(eventItem.id)}"
                      data-participant-id="${escapeHtml(participant.id)}"
                    >
                      <option value="yes" ${status === "yes" ? "selected" : ""}>${PARTICIPANT_STATUS_LABELS.yes}</option>
                      <option value="maybe" ${status === "maybe" ? "selected" : ""}>${PARTICIPANT_STATUS_LABELS.maybe}</option>
                      <option value="no" ${status === "no" ? "selected" : ""}>${PARTICIPANT_STATUS_LABELS.no}</option>
                    </select>
                  </span>
                </div>
                <button
                  type="button"
                  class="participant-card__remove"
                  aria-label="Teilnehmer entfernen"
                  data-action="unassign-participant"
                  data-event-id="${escapeHtml(eventItem.id)}"
                  data-participant-id="${escapeHtml(participant.id)}"
                >
                  ${renderIcon("close")}
                </button>
              </article>
            `).join("")
            : '<p class="participants-empty">Noch keine Teilnehmer zugeordnet.</p>'}
        </div>
      </section>
    `;
  }

  // Zentraler Modal-Router, der je nach Typ den passenden Renderer waehlt.
  _renderModal() {
    const modal = this.ui?.modal;
    if (!modal) return "";

    if (modal.type === "event-form") return this._renderEventFormModal(modal);
    if (modal.type === "invite") return this._renderInviteModal(modal);
    if (modal.type === "tag-manager") return this._renderTagManagerModal(modal);
    if (modal.type === "confirm") return this._renderConfirmModal(modal);
    if (modal.type === "feedback") return this._renderFeedbackModal(modal);
    return "";
  }

  // Modal zum Erstellen/Bearbeiten eines Events.
  _renderEventFormModal(modal) {
    const values = {
      title: "",
      date: "",
      time: "",
      endTime: "",
      location: "",
      status: "planned",
      description: "",
      tagIds: [],
      ...(modal.values ?? {})
    };

    const errors = modal.errors ?? {};
    const tagIds = toArray(values.tagIds);

    return `
      <div class="modal-overlay" role="presentation">
        <div class="modal modal--form" role="dialog" aria-modal="true" aria-label="Event Formular">
          <h2 class="modal__title">${modal.mode === "edit" ? "Event bearbeiten" : "Neues Event erstellen"}</h2>

          <form class="modal-form" data-submit-action="save-event-form" data-mode="${escapeHtml(modal.mode)}" data-event-id="${escapeHtml(modal.eventId ?? "")}">
            ${this._renderField("Titel des Events *", "title", "text", values.title, errors.title, "z.B. Semester Opening")}

            <div class="modal-form__row">
              ${this._renderField("Datum *", "date", "date", values.date, errors.date, "")}
              ${this._renderField("Startzeit *", "time", "time", values.time, errors.time, "")}
            </div>

            <div class="modal-form__row">
              ${this._renderField("Endzeit *", "endTime", "time", values.endTime, errors.endTime, "")}
              ${this._renderField("Ort *", "location", "text", values.location, errors.location, "Ort oder Raum")}
            </div>

            <label class="modal-field">
              <span class="modal-field__label">Status <span class="required-asterisk" aria-hidden="true">*</span></span>
              <select name="status" class="modal-field__control">
                <option value="planned" ${values.status === "planned" ? "selected" : ""}>Geplant</option>
                <option value="completed" ${values.status === "completed" ? "selected" : ""}>Abgeschlossen</option>
              </select>
              ${errors.status ? `<span class="field-error">${escapeHtml(errors.status)}</span>` : ""}
            </label>

            <fieldset class="tag-chooser">
              <legend class="modal-field__label">Tags auswählen</legend>
              <div class="tag-chooser__items">
                ${this.state.tags.map((tag) => `
                  <label class="tag-chooser__item">
                    <input type="checkbox" name="tagIds" value="${escapeHtml(tag.id)}" ${tagIds.includes(tag.id) ? "checked" : ""}>
                    <span>${escapeHtml(tag.name)}</span>
                  </label>
                `).join("")}
              </div>
            </fieldset>

            <label class="modal-field">
              <span class="modal-field__label">Beschreibung <span class="required-asterisk" aria-hidden="true">*</span></span>
              <textarea name="description" rows="4" class="modal-field__control" placeholder="Details zum Event...">${escapeHtml(values.description)}</textarea>
              ${errors.description ? `<span class="field-error">${escapeHtml(errors.description)}</span>` : ""}
            </label>

            <div class="modal__actions">
              <button type="button" class="btn-secondary" data-action="close-modal">Abbrechen</button>
              <button type="submit" class="btn-primary">Event speichern</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Modal zum Einladen weiterer Teilnehmer.
  _renderInviteModal(modal) {
    const eventItem = this.state.events.find((item) => item.id === modal.eventId);
    if (!eventItem) return "";

    const assignedIds = new Set(eventItem.participants.map((item) => item.participantId));
    const query = modal.query ?? "";
    const selectedIds = new Set(modal.selectedIds ?? []);

    const visibleParticipants = this.state.participants.filter((participant) => {
      const text = `${participant.firstName} ${participant.lastName} ${participant.nickname}`;
      return matchesSearchWords(text, query);
    });

    return `
      <div class="modal-overlay" role="presentation">
        <div class="modal" role="dialog" aria-modal="true" aria-label="Teilnehmer einladen">
          <h2 class="modal__title">Teilnehmer einladen</h2>

          <label class="modal-field modal-field--compact">
            <span class="modal-field__label">Teilnehmer suchen</span>
            <input
              id="invite-search"
              class="modal-field__control"
              type="search"
              placeholder="Teilnehmer suchen..."
              value="${escapeHtml(modal.query ?? "")}"
              data-input-action="invite-query"
            />
          </label>

          <div class="invite-list">
            ${visibleParticipants.length > 0 ? visibleParticipants.map((participant) => {
              const isAssigned = assignedIds.has(participant.id);
              const checked = selectedIds.has(participant.id);
              return `
                <label class="invite-list__item ${isAssigned ? "invite-list__item--disabled" : ""}">
                  <input
                    type="checkbox"
                    ${isAssigned ? "disabled" : ""}
                    ${checked ? "checked" : ""}
                    data-change-action="toggle-invite-selection"
                    data-participant-id="${escapeHtml(participant.id)}"
                  />
                  <span>${escapeHtml(participant.firstName)} ${escapeHtml(participant.lastName)} ${isAssigned ? "(bereits zugeordnet)" : ""}</span>
                </label>
              `;
            }).join("") : '<p class="invite-list__empty">Keine Treffer.</p>'}
          </div>

          <div class="modal__actions">
            <button type="button" class="btn-secondary" data-action="close-modal">Abbrechen</button>
            <button type="button" class="btn-primary" data-action="save-invite-modal">Einladen</button>
          </div>
        </div>
      </div>
    `;
  }

  // Modal zum Verwalten der Tag-Liste.
  _renderTagManagerModal(modal) {
    const rows = (modal.rows ?? []).filter((row) => !row.deleted);
    const editingRow = rows.find((row) => row.isEditing) ?? null;
    const editingRowId = editingRow?.id ?? "";
    const hasEditingRow = Boolean(editingRow);
    const query = modal.query ?? "";
    const visibleRows = rows.filter((row) => {
      const isEditing = row.id === editingRowId;
      const value = String(isEditing ? row.draftName : row.name);
      return matchesSearchWords(value, query);
    });

    return `
      <div class="modal-overlay" role="presentation">
        <div class="modal modal--tag-manager" role="dialog" aria-modal="true" aria-label="Tags verwalten">
          <div class="modal__toolbar">
            <h2 class="modal__title">Tags verwalten</h2>
            <button class="toolbar-plus" type="button" data-action="tag-row-add" aria-label="Tag hinzufuegen" ${hasEditingRow ? "disabled" : ""}>${renderIcon("plus")}</button>
          </div>

          <label class="modal-field modal-field--compact">
            <span class="modal-field__label">Tags suchen</span>
            <input id="tag-manager-search" class="modal-field__control" type="search" value="${escapeHtml(modal.query ?? "")}" placeholder="Tags suchen..." data-input-action="tag-query" ${hasEditingRow ? "disabled" : ""} />
          </label>

          <div class="tag-manager-list ${hasEditingRow ? "tag-manager-list--editing" : ""}">
            ${visibleRows.length > 0
              ? visibleRows.map((row) => {
                const isEditing = row.id === editingRowId;
                const isLocked = hasEditingRow && !isEditing;
                const palette = this._getTagPalette(row.id);
                return `
              <div class="tag-manager-row ${isLocked ? "tag-manager-row--locked" : ""}">
                <input
                  class="tag-manager-row__input ${isEditing ? "" : "tag-manager-row__input--readonly"}"
                  type="text"
                  value="${escapeHtml(isEditing ? row.draftName : row.name)}"
                  ${isEditing ? "" : "readonly"}
                  ${isLocked ? "disabled" : ""}
                  data-input-action="${isEditing ? "tag-row-draft-name" : ""}"
                  data-row-id="${escapeHtml(row.id)}"
                />
                <div class="tag-manager-row__actions">
                  <span class="tag-manager-row__color-dot" aria-hidden="true" style="background:${palette.background};box-shadow:inset 0 0 0 1px ${palette.border};"></span>
                  <button
                    class="tag-manager-row__edit"
                    type="button"
                    data-action="${isEditing ? "tag-row-commit-edit" : "tag-row-start-edit"}"
                    data-row-id="${escapeHtml(row.id)}"
                    aria-label="${isEditing ? "Bearbeitung speichern" : "Tag bearbeiten"}"
                    ${isLocked ? "disabled" : ""}
                  >
                    ${renderIcon(isEditing ? "check" : "edit")}
                  </button>
                  <button
                    class="tag-manager-row__delete"
                    type="button"
                    data-action="tag-row-remove"
                    data-row-id="${escapeHtml(row.id)}"
                    aria-label="Tag entfernen"
                    ${hasEditingRow ? "disabled" : ""}
                  >
                    ${renderIcon("trash")}
                  </button>
                </div>
              </div>
            `;
              }).join("")
              : '<div class="sidebar-empty">Keine Tags gefunden.</div>'}
          </div>
          ${modal.error ? `<p class="field-error">${escapeHtml(modal.error)}</p>` : ""}

          <div class="modal__actions">
            <button type="button" class="btn-secondary" data-action="close-modal">Abbrechen</button>
            <button type="button" class="btn-primary" data-action="save-tag-manager" ${hasEditingRow ? "disabled" : ""}>Speichern</button>
          </div>
        </div>
      </div>
    `;
  }

  // Standard-Bestätigungsdialog fuer kritische Aktionen.
  _renderConfirmModal(modal) {
    const eventIdAttribute = modal.eventId
      ? ` data-event-id="${escapeHtml(modal.eventId)}"`
      : "";
    const participantIdAttribute = modal.participantId
      ? ` data-participant-id="${escapeHtml(modal.participantId)}"`
      : "";

    return `
      <div class="modal-overlay" role="presentation">
        <div class="modal modal--small" role="dialog" aria-modal="true" aria-label="Bestaetigung">
          <h2 class="modal__title">${escapeHtml(modal.title ?? "Bitte bestätigen")}</h2>
          <p class="modal__text">${escapeHtml(modal.message ?? "")}</p>
          <div class="modal__actions">
            <button type="button" class="btn-secondary" data-action="close-modal">Abbrechen</button>
            <button type="button" class="btn-primary" data-action="${escapeHtml(modal.confirmAction ?? "")}" data-target-id="${escapeHtml(modal.targetId ?? "")}"${eventIdAttribute}${participantIdAttribute}>${escapeHtml(modal.confirmLabel ?? "Loeschen")}</button>
          </div>
        </div>
      </div>
    `;
  }

  // Einfacher Hinweisdialog für Erfolg/Fehler-Feedback.
  _renderFeedbackModal(modal) {
    return `
      <div class="modal-overlay" role="presentation">
        <div class="modal modal--small" role="dialog" aria-modal="true" aria-label="Feedback">
          <h2 class="modal__title">${escapeHtml(modal.title ?? "Hinweis")}</h2>
          <p class="modal__text">${escapeHtml(modal.message ?? "")}</p>
          <div class="modal__actions modal__actions--center">
            <button type="button" class="btn-primary" data-action="close-modal">Ok</button>
          </div>
        </div>
      </div>
    `;
  }

  _renderField(label, name, type, value, error, placeholder) {
    const labelText = String(label ?? "");
    const labelHtml = labelText.endsWith("*")
      ? `${escapeHtml(labelText.slice(0, -1).trim())} <span class="required-asterisk" aria-hidden="true">*</span>`
      : escapeHtml(labelText);

    return `
      <label class="modal-field">
        <span class="modal-field__label">${labelHtml}</span>
        <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" class="modal-field__control" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
        ${error ? `<span class="field-error">${escapeHtml(error)}</span>` : ""}
      </label>
    `;
  }
}

// Registriert die Komponente genau einmal im Browser.
if (!customElements.get("eventbuddy-app")) {
  customElements.define("eventbuddy-app", EventBuddyAppView);
}













