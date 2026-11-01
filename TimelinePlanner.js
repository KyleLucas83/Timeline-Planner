(function () {
  'use strict';

  const root = document.getElementById('app');
  if (!root) return;

  const immutable = window.Immutable;
  if (!immutable) {
    root.innerHTML = '<div style="padding:20px;color:#b00;">Immutable.js is required.</div>';
    return;
  }

  const { fromJS } = immutable;
  const STORAGE_KEY = 'timeline-planner-state-v1';
  const THEME_KEY = 'timeline-planner-theme';
  const VIEW_KEY = 'timeline-planner-view';
  const SQL_JS_ASSETS = 'assets/vendor/';
  let lastStatusText = 'Saved';
  let sliderDrag = null;
  let sqlJsPromise = null;
  let handlersBound = false;

  function defaultState() {
    const today = new Date();
    const initialDate = toISODate(today);

    return fromJS({
      selectedDate: initialDate,
      selectedEventId: 'evt-2',
      activeTagFilter: 'all',
      view: loadView(),
      modalMode: 'create',
      dragState: null,
      isDirty: false,
      plan: {
        id: 'plan-main',
        name: 'Main planner',
        items: [
          {
            id: 'evt-1',
            title: 'Design Review',
            type: 'work',
            startDate: offsetDate(initialDate, -2),
            endDate: offsetDate(initialDate, 2),
            notes: 'Review timeline structure and UX flow.',
            tags: ['design', 'planning'],
            recurrence: 'weekly',
            status: 'planned'
          },
          {
            id: 'evt-2',
            title: 'Workout',
            type: 'health',
            startDate: initialDate,
            endDate: initialDate,
            notes: 'Strength session and mobility work.',
            tags: ['wellness', 'routine'],
            recurrence: 'weekly',
            status: 'active'
          },
          {
            id: 'evt-3',
            title: 'Trip Planning',
            type: 'travel',
            startDate: offsetDate(initialDate, 5),
            endDate: offsetDate(initialDate, 8),
            notes: 'Finalize flights and lodging.',
            tags: ['travel', 'planning'],
            recurrence: 'monthly',
            status: 'planned'
          },
          {
            id: 'evt-4',
            title: 'Project Deadline',
            type: 'deadline',
            startDate: offsetDate(initialDate, 12),
            endDate: offsetDate(initialDate, 15),
            notes: 'Final handoff package due.',
            tags: ['deadline', 'critical'],
            recurrence: 'none',
            status: 'urgent'
          }
        ]
      }
    });
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return fromJS(normalizeState(JSON.parse(raw)));
    } catch (error) {
      console.warn('Could not load timeline state:', error);
      return defaultState();
    }
  }

  function normalizeState(payload, preferStoredView = true) {
    const defaults = defaultState().toJS();
    const canonical = payload && payload.data && payload.customizations;
    const legacyState = canonical ? {} : (payload && payload.state ? payload.state : payload);
    const plan = canonical ? payload.data.plan : legacyState && legacyState.plan;
    if (!plan || !Array.isArray(plan.items)) {
      throw new Error('The saved timeline data is missing its planner events.');
    }

    const settings = canonical ? payload.settings || {} : {};
    const customizations = canonical ? payload.customizations : {};
    const legacyTheme = payload && payload.theme ? payload.theme : loadTheme();
    const theme = customizations.theme || legacyTheme;
    const savedView = canonical ? settings.view : legacyState && legacyState.view;

    return {
      ...defaults,
      ...legacyState,
      plan,
      selectedDate: customizations.activeDate || (legacyState && legacyState.selectedDate) || defaults.selectedDate,
      selectedEventId: customizations.selectedEventId !== undefined
        ? customizations.selectedEventId
        : legacyState && legacyState.selectedEventId !== undefined
          ? legacyState.selectedEventId
          : defaults.selectedEventId,
      activeTagFilter: customizations.activeTagFilter || (legacyState && legacyState.activeTagFilter) || 'all',
      view: preferStoredView
        ? loadView(['month', 'week', 'day'].includes(savedView) ? savedView : defaults.view)
        : (['month', 'week', 'day'].includes(savedView) ? savedView : loadView(defaults.view)),
      theme: ['standard', 'dark', 'forest', 'sky'].includes(theme) ? theme : 'standard',
      modalMode: 'create',
      dragState: null,
      isDirty: false
    };
  }

  function buildSaveBundle(sourceState = state) {
    const current = sourceState.toJS();
    return {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      data: {
        plan: current.plan
      },
      settings: {
        view: current.view
      },
      customizations: {
        theme: loadTheme(),
        activeDate: current.selectedDate,
        selectedEventId: current.selectedEventId,
        activeTagFilter: current.activeTagFilter
      }
    };
  }

  function initializeSqlJs() {
    if (!sqlJsPromise) {
      if (typeof window.initSqlJs !== 'function') {
        return Promise.reject(new Error('SQLite support could not be loaded. Check your connection and try again.'));
      }
      sqlJsPromise = window.initSqlJs({
        locateFile: (file) => `${SQL_JS_ASSETS}${file}`
      }).catch((error) => {
        sqlJsPromise = null;
        throw error;
      });
    }
    return sqlJsPromise;
  }

  function loadTheme() {
    try {
      return localStorage.getItem(THEME_KEY) || 'standard';
    } catch (error) {
      return 'standard';
    }
  }

  function loadView(fallbackView = 'month') {
    try {
      const savedView = localStorage.getItem(VIEW_KEY);
      return ['month', 'week', 'day'].includes(savedView) ? savedView : fallbackView;
    } catch (error) {
      return fallbackView;
    }
  }

  function saveState(nextState) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveBundle(nextState)));
  }

  function downloadFile(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function readSqliteBundle(file) {
    const SQL = await initializeSqlJs();
    const database = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
    try {
      const results = database.exec('SELECT payload FROM timeline_data WHERE id = 1');
      if (!results.length || !results[0].values.length) {
        throw new Error('The SQLite file does not contain a saved timeline plan.');
      }
      return JSON.parse(results[0].values[0][0]);
    } finally {
      database.close();
    }
  }

  function setStatus(text, isWarning) {
    lastStatusText = text;
    const statusEl = document.getElementById('save-status');
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('warn', !!isWarning);
  }

  function applyTheme(themeName) {
    const nextTheme = themeName || 'standard';
    document.body.setAttribute('data-theme', nextTheme);
    try {
      localStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {
      console.warn('Could not save selected theme:', error);
    }
  }

  function saveView(viewName) {
    try {
      localStorage.setItem(VIEW_KEY, viewName);
    } catch (error) {
      console.warn('Could not save selected view:', error);
    }
  }

  function markDirty() {
    state = state.set('isDirty', true);
    setStatus('Unsaved changes', true);
  }

  function clearDirty() {
    state = state.set('isDirty', false);
    setStatus('Saved', false);
  }

  let state = loadState();

  function getEventTags(item) {
    if (!item) return [];
    const tags = item.get('tags');
    if (Array.isArray(tags)) return tags.filter(Boolean).map((tag) => String(tag).trim()).filter(Boolean);
    if (typeof tags === 'string') {
      return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    }
    return [];
  }

  function getRecurrenceLabel(value) {
    if (!value || value === 'none') return '';
    const labels = {
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly'
    };
    return labels[value] || value;
  }

  function getAllTags(items) {
    const unique = new Set();
    items.forEach((item) => {
      getEventTags(item).forEach((tag) => unique.add(tag));
    });
    return Array.from(unique).sort((left, right) => left.localeCompare(right));
  }

  function getVisibleItems(items, activeTagFilter) {
    if (!activeTagFilter || activeTagFilter === 'all') return items;
    return items.filter((item) => getEventTags(item).includes(activeTagFilter));
  }

  function renderTagFilters(items) {
    const allTags = getAllTags(items);
    const chips = ['all', ...allTags];
    const activeTag = state.get('activeTagFilter') || 'all';

    return chips.map((tag) => `
      <button class="tag-filter-chip ${tag === activeTag ? 'selected' : ''}" data-tag-filter="${tag}">
        ${tag === 'all' ? 'All' : escapeHtml(tag)}
      </button>
    `).join('');
  }

  function getSliderRangeDays(view) {
    switch (view) {
      case 'day': return 12;
      case 'week': return 42;
      case 'month':
      default: return 180;
    }
  }

  function getSliderStepDays(view) {
    switch (view) {
      case 'day': return 1;
      case 'week': return 7;
      case 'month':
      default: return 30;
    }
  }

  function getTimelineBubblePercent(index) {
    return ((index + 6) / 12) * 100;
  }

  function getNearestBubbleIndex(percent) {
    const normalized = (percent / 100) * 12 - 6;
    return clamp(Math.round(normalized), -6, 6);
  }

  function buildTimelineLabels(selectedDate, view) {
    const step = getSliderStepDays(view);
    const labels = [];

    for (let index = -6; index <= 6; index += 1) {
      const labelDate = offsetDate(selectedDate, index * step);
      const leftPercent = getTimelineBubblePercent(index);
      const bubbleClass = index === 0 ? 'center' : (index % 2 === 0 ? 'below' : 'above');
      labels.push(`
        <div class="timeline-bubble ${bubbleClass}" style="left: ${leftPercent}%">
          ${formatTimelineLabel(labelDate, view)}
        </div>
      `);
    }

    return labels.join('');
  }

  function formatTimelineLabel(dateString, view) {
    const date = parseISO(dateString);
    if (view === 'month') {
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function renderDateMarkers(items, dateString) {
    const starts = items.filter((item) => item.get('startDate') === dateString);
    if (!starts.length) return '';

    return `
      <div class="date-markers" aria-label="${starts.length} event${starts.length > 1 ? 's' : ''} on this date">
        ${starts.map((item) => `
          <span
            class="timeline-marker ${item.get('type')}"
            title="${escapeHtml(item.get('title'))}"
            aria-label="${escapeHtml(item.get('title'))}"
          ></span>
        `).join('')}
      </div>
    `;
  }

  function render() {
    const selectedDate = state.get('selectedDate');
    const view = state.get('view');
    const items = state.getIn(['plan', 'items']);
    const visibleItems = getVisibleItems(items, state.get('activeTagFilter'));
    const selectedEventId = state.get('selectedEventId');
    const isDirty = !!state.get('isDirty');
    const handlePercent = sliderDrag ? sliderDrag.handlePercent : 50;
    const timelineLabels = buildTimelineLabels(selectedDate, view);

    root.innerHTML = `
      <div class="timeline-app">
        <header class="topbar">
          <div class="topbar-left">
            <img class="brand" src="assets/goodomens-titlebar.svg" alt="GoodOmens Timeline Planner" />
            <div class="view-toggle">
              <button class="view-button ${view === 'month' ? 'active' : ''}" data-view="month">Month</button>
              <button class="view-button ${view === 'week' ? 'active' : ''}" data-view="week">Week</button>
              <button class="view-button ${view === 'day' ? 'active' : ''}" data-view="day">Day</button>
            </div>
          </div>

          <div class="topbar-right">
            <div class="theme-selector">
              <label for="theme-select">Theme</label>
              <select id="theme-select">
                <option value="standard">Standard</option>
                <option value="dark">Dark Theme</option>
                <option value="forest">Forest Theme</option>
                <option value="sky">Sky Theme</option>
              </select>
            </div>
            <div id="save-status" class="save-status ${isDirty ? 'warn' : ''}">${isDirty ? 'Unsaved changes' : lastStatusText}</div>
            <button class="save-btn" id="save-plan-btn">Save Local</button>
            <button class="export-btn" id="export-json-btn">Save JSON</button>
            <button class="export-btn" id="export-sqlite-btn">Save SQLite</button>
            <button class="import-btn" id="import-json-btn">Import</button>
            <input type="file" id="json-import-input" class="hidden" accept=".json,.sqlite,.sqlite3,.db,application/json,application/x-sqlite3" />
            <button class="primary-btn" id="new-item-btn">+ New Event</button>
          </div>
        </header>

        <div class="filter-row">${renderTagFilters(items)}</div>

        <div class="planner-shell">
          <div class="timeline-toolbar">
            <div class="period-label">${formatMonthYear(selectedDate)}</div>
            <div class="period-label">${selectedDate}</div>
          </div>

          <div class="focus-rail" id="focus-rail">
            <div class="timeline-labels">${timelineLabels}</div>
            <div class="focus-track"></div>
            <div class="focus-line" style="left: ${handlePercent}%"></div>
            <div class="focus-handle" id="focus-handle" style="left: ${handlePercent}%"></div>
          </div>

          <div class="${view === 'day' ? 'day-grid' : (view === 'week' ? 'week-grid' : 'month-grid')}">
            ${renderCurrentView(view, selectedDate, visibleItems, selectedEventId)}
          </div>
        </div>

        <div class="detail-panel">
          <div class="detail-card">
            ${renderDetail(selectedDate, items, selectedEventId, isDirty)}
          </div>
        </div>
      </div>
    `;

    applyTheme(loadTheme());
    bindHandlers();

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.value = loadTheme();
    }

    const saveStatus = document.getElementById('save-status');
    if (saveStatus) {
      saveStatus.textContent = isDirty ? 'Unsaved changes' : lastStatusText;
      saveStatus.classList.toggle('warn', isDirty);
    }
  }

  function bindHandlers() {
    document.querySelectorAll('.view-button').forEach((button) => {
      button.addEventListener('click', () => {
        state = state.set('view', button.dataset.view);
        saveView(button.dataset.view);
        sliderDrag = null;
        render();
      });
    });

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      themeSelect.addEventListener('change', (event) => {
        applyTheme(event.target.value);
      });
    }

    const newItemBtn = document.getElementById('new-item-btn');
    if (newItemBtn) {
      newItemBtn.addEventListener('click', () => {
        openModal('create', state.get('selectedDate'));
      });
    }

    const saveBtn = document.getElementById('save-plan-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const nextState = state.set('isDirty', false);
        try {
          saveState(nextState);
          state = nextState;
          clearDirty();
          render();
        } catch (error) {
          console.error('Could not save timeline data to localStorage:', error);
          setStatus('Local save failed', true);
        }
      });
    }

    const exportBtn = document.getElementById('export-json-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        try {
          downloadFile(JSON.stringify(buildSaveBundle(), null, 2), 'application/json', 'timeline-planner.json');
          setStatus('Saved JSON file');
        } catch (error) {
          console.error('Could not export timeline JSON:', error);
          setStatus('JSON save failed', true);
        }
      });
    }

    const sqliteExportBtn = document.getElementById('export-sqlite-btn');
    if (sqliteExportBtn) {
      sqliteExportBtn.addEventListener('click', async () => {
        let database;
        try {
          const SQL = await initializeSqlJs();
          database = new SQL.Database();
          database.run('CREATE TABLE timeline_data (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)');
          database.run('INSERT INTO timeline_data (id, payload) VALUES (?, ?)', [
            1,
            JSON.stringify(buildSaveBundle())
          ]);
          downloadFile(database.export(), 'application/x-sqlite3', 'timeline-planner.sqlite');
          setStatus('Saved SQLite file');
        } catch (error) {
          console.error('Could not export timeline SQLite database:', error);
          setStatus('SQLite save failed', true);
        } finally {
          if (database) database.close();
        }
      });
    }

    const importBtn = document.getElementById('import-json-btn');
    const importInput = document.getElementById('json-import-input');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', async (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;

        importInput.value = '';
        try {
          const isSqlite = /\.(sqlite|sqlite3|db)$/i.test(file.name)
            || file.type === 'application/x-sqlite3';
          const importedPayload = isSqlite
            ? await readSqliteBundle(file)
            : JSON.parse(await file.text());
          state = fromJS(normalizeState(importedPayload, false));
          applyTheme(state.get('theme'));
          saveView(state.get('view'));
          markDirty();
          render();
          setStatus('Imported; save to keep', true);
        } catch (error) {
          console.error('Import failed:', error);
          setStatus('Import failed', true);
        }
      });
    }

    if (handlersBound) return;
    handlersBound = true;

    document.addEventListener('click', (event) => {
      const modalClose = event.target.closest('[data-close="modal"]');
      if (modalClose) {
        closeModal();
        return;
      }

      const tagFilterChip = event.target.closest('[data-tag-filter]');
      if (tagFilterChip) {
        state = state.set('activeTagFilter', tagFilterChip.dataset.tagFilter || 'all');
        render();
        return;
      }

      const eventCard = event.target.closest('.event-card');
      if (eventCard) {
        const eventId = eventCard.dataset.eventId;
        state = state.set('selectedEventId', eventId);
        const item = findEventById(state.getIn(['plan', 'items']), eventId);
        if (item) {
          state = state.set('selectedDate', item.get('startDate'));
        }
        render();
        return;
      }

      const editButton = event.target.closest('[data-edit-event]');
      if (editButton) {
        const eventId = editButton.dataset.editEvent;
        openModal('edit', state.get('selectedDate'), eventId);
      }
    });

    document.addEventListener('dblclick', (event) => {
      const eventCard = event.target.closest('.event-card');
      if (!eventCard) return;

      const eventId = eventCard.dataset.eventId;
      openModal('edit', state.get('selectedDate'), eventId);
    });

    document.addEventListener('pointerdown', (event) => {
      const sliderHandle = event.target.closest('#focus-handle');
      if (sliderHandle) {
        const rail = document.getElementById('focus-rail');
        if (!rail) return;

        const rect = rail.getBoundingClientRect();
        sliderDrag = {
          baseDate: state.get('selectedDate'),
          handlePercent: 50,
          startX: event.clientX,
          rectWidth: rect.width,
          pointerId: event.pointerId
        };
        event.preventDefault();
        return;
      }

      const eventCard = event.target.closest('.event-card');
      if (!eventCard) return;

      event.preventDefault();

      const eventId = eventCard.dataset.eventId;
      const item = findEventById(state.getIn(['plan', 'items']), eventId);
      if (!item) return;

      state = state.set('selectedEventId', eventId);
      state = state.set('dragState', fromJS({
        eventId,
        originalStartDate: item.get('startDate'),
        originalEndDate: item.get('endDate')
      }));

      const activeCard = document.querySelector(`.event-card[data-event-id="${eventId}"]`);
      if (activeCard) {
        activeCard.classList.add('dragging');
      }

      eventCard.setPointerCapture && eventCard.setPointerCapture(event.pointerId);
    });

    document.addEventListener('pointermove', (event) => {
      if (sliderDrag) {
        const rail = document.getElementById('focus-rail');
        if (!rail) return;

        const rect = rail.getBoundingClientRect();
        const pos = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
        const bubbleIndex = getNearestBubbleIndex(pos);
        const nextDate = offsetDate(sliderDrag.baseDate, bubbleIndex * getSliderStepDays(state.get('view')));

        state = state.set('selectedDate', nextDate);
        sliderDrag.handlePercent = getTimelineBubblePercent(bubbleIndex);
        render();
        return;
      }

      const dragState = state.get('dragState');
      if (!dragState) return;

      const column = document.elementFromPoint(event.clientX, event.clientY)?.closest('.day-column');
      if (!column) return;

      const targetDate = column.dataset.date;
      if (!targetDate) return;

      const item = findEventById(state.getIn(['plan', 'items']), dragState.get('eventId'));
      if (!item) return;

      const originalStart = parseISO(dragState.get('originalStartDate'));
      const originalEnd = parseISO(dragState.get('originalEndDate'));
      const targetStart = parseISO(targetDate);

      const deltaDays = diffDays(targetStart, originalStart);
      const duration = diffDays(originalEnd, originalStart) + 1;
      const nextStart = offsetDate(dragState.get('originalStartDate'), deltaDays);
      const nextEnd = offsetDate(nextStart, duration - 1);

      const currentStart = item.get('startDate');
      const currentEnd = item.get('endDate');
      if (currentStart === nextStart && currentEnd === nextEnd) return;

      state = state.updateIn(['plan', 'items'], (items) =>
        items.map((entry) => {
          if (entry.get('id') !== dragState.get('eventId')) return entry;
          return entry.set('startDate', nextStart).set('endDate', nextEnd);
        })
      );

      state = state.set('selectedDate', nextStart);
      markDirty();
      render();
    });

    document.addEventListener('pointerup', () => {
      if (sliderDrag) {
        sliderDrag = null;
        render();
        return;
      }

      document.querySelectorAll('.event-card.dragging').forEach((node) => node.classList.remove('dragging'));
      state = state.set('dragState', null);
    });

    const form = document.getElementById('event-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();

        const id = form.eventId.value || 'evt-' + Date.now();
        const title = form.title.value.trim();
        const type = form.type.value;
        const startDate = form.startDate.value;
        const endDate = form.endDate.value;
        const notes = form.notes.value.trim() || 'No notes.';
        const tags = (form.tags.value || '')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        const recurrence = form.recurrence.value || 'none';
        const status = form.status.value || 'planned';

        if (!title) { alert('Please enter an event title.'); return; }
        if (!startDate || !endDate) { alert('Please choose both dates.'); return; }
        if (startDate > endDate) { alert('End date cannot be before start date.'); return; }

        if (form.dataset.mode === 'edit') {
          state = state.updateIn(['plan', 'items'], (items) =>
            items.map((entry) => {
              if (entry.get('id') !== id) return entry;
              return entry
                .set('title', title)
                .set('type', type)
                .set('startDate', startDate)
                .set('endDate', endDate)
                .set('notes', notes)
                .set('tags', fromJS(tags))
                .set('recurrence', recurrence)
                .set('status', status);
            })
          );
        } else {
          const newEvent = fromJS({
            id,
            title,
            type,
            startDate,
            endDate,
            notes,
            tags,
            recurrence,
            status
          });

          state = state.updateIn(['plan', 'items'], (items) => items.push(newEvent));
        }

        state = state.set('selectedEventId', id);
        state = state.set('selectedDate', startDate);
        markDirty();
        closeModal();
        render();
      });
    }

    const deleteBtn = document.getElementById('delete-event-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const eventId = document.getElementById('event-id').value;
        if (!eventId) return;

        state = state.updateIn(['plan', 'items'], (items) =>
          items.filter((item) => item.get('id') !== eventId)
        );

        state = state.set('selectedEventId', null);
        markDirty();
        closeModal();
        render();
      });
    }
  }

  function openModal(mode, selectedDate, eventId) {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    const titleInput = document.getElementById('event-title');
    const typeInput = document.getElementById('event-type');
    const startInput = document.getElementById('event-start');
    const endInput = document.getElementById('event-end');
    const notesInput = document.getElementById('event-notes');
    const tagsInput = document.getElementById('event-tags');
    const recurrenceInput = document.getElementById('event-recurring');
    const statusInput = document.getElementById('event-status');
    const dateId = document.getElementById('event-id');
    const deleteBtn = document.getElementById('delete-event-btn');

    if (!modal || !form || !titleInput || !typeInput || !startInput || !endInput || !notesInput || !tagsInput || !recurrenceInput || !statusInput || !dateId) return;

    form.dataset.mode = mode;

    if (mode === 'edit' && eventId) {
      const item = findEventById(state.getIn(['plan', 'items']), eventId);
      if (!item) return;

      document.getElementById('event-modal-title').textContent = 'Edit Event';
      dateId.value = item.get('id');
      titleInput.value = item.get('title');
      typeInput.value = item.get('type') || 'work';
      startInput.value = item.get('startDate');
      endInput.value = item.get('endDate');
      notesInput.value = item.get('notes');
      tagsInput.value = (getEventTags(item)).join(', ');
      recurrenceInput.value = item.get('recurrence') || 'none';
      statusInput.value = item.get('status') || 'planned';
      deleteBtn.classList.remove('hidden');
    } else {
      document.getElementById('event-modal-title').textContent = 'Create Event';
      form.reset();
      dateId.value = '';
      typeInput.value = 'work';
      recurrenceInput.value = 'none';
      statusInput.value = 'planned';
      startInput.value = selectedDate || state.get('selectedDate');
      endInput.value = selectedDate || state.get('selectedDate');
      deleteBtn.classList.add('hidden');
    }

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => titleInput.focus(), 30);
  }

  function closeModal() {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (form) {
      form.reset();
      form.dataset.mode = 'create';
    }
    const deleteBtn = document.getElementById('delete-event-btn');
    if (deleteBtn) deleteBtn.classList.add('hidden');
  }

  function renderEventBadges(item) {
    const badges = [];
    const tags = getEventTags(item);
    const recurrence = item.get('recurrence');

    if (tags.length > 0) {
      badges.push(`<span class="meta-badge tag">${escapeHtml(tags[0])}</span>`);
    }
    if (recurrence && recurrence !== 'none') {
      badges.push(`<span class="meta-badge recurrence">${escapeHtml(getRecurrenceLabel(recurrence))}</span>`);
    }
    return badges.join('');
  }

  function renderCurrentView(view, selectedDate, items, selectedEventId) {
    if (view === 'week') return renderWeekView(selectedDate, items, selectedEventId);
    if (view === 'day') return renderDayView(selectedDate, items, selectedEventId);
    return renderMonthView(selectedDate, items, selectedEventId);
  }

  function renderMonthView(selectedDate, items, selectedEventId) {
    const d = parseISO(selectedDate);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const leading = monthStart.getDay();
    const cells = [];

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(d.getFullYear(), d.getMonth(), i - leading + 1);
      const iso = toISODate(cellDate);
      const inMonth = cellDate.getMonth() === d.getMonth();
      const isSelected = iso === selectedDate;
      const isToday = iso === toISODate(new Date());
      const dateMarkers = renderDateMarkers(items, iso);
      const dateEvents = items.filter((item) => iso >= item.get('startDate') && iso <= item.get('endDate'));

      const cards = dateEvents
        .map((item) => {
          const type = item.get('type');
          const isSelectedEvent = item.get('id') === selectedEventId;
          return `
            <div class="event-card ${type} ${isSelectedEvent ? 'selected' : ''}" data-event-id="${item.get('id')}">
              <span class="event-label">${escapeHtml(item.get('title'))}</span>
              <div class="event-badges">${renderEventBadges(item)}</div>
              <span class="event-dot">•</span>
            </div>
          `;
        })
        .join('');

      cells.push(`
        <div class="day-column" data-date="${iso}">
          <div class="day-header">${getShortWeekday(cellDate)}</div>
          <div class="day-body">
            <span class="day-number ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${!inMonth ? 'outside-month' : ''}">${cellDate.getDate()}</span>
            ${dateMarkers || '<div class="date-markers empty-marker"></div>'}
            ${cards}
          </div>
        </div>
      `);
    }

    return cells.join('');
  }

  function renderWeekView(selectedDate, items, selectedEventId) {
    const date = parseISO(selectedDate);
    const start = new Date(date);
    const offset = (date.getDay() + 6) % 7;
    start.setDate(date.getDate() - offset);

    const cells = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      const iso = toISODate(current);
      const isSelected = iso === selectedDate;
      const dateMarkers = renderDateMarkers(items, iso);

      const cards = items.filter((item) => iso >= item.get('startDate') && iso <= item.get('endDate'))
        .map((item) => `
          <div class="event-card ${item.get('type')} ${item.get('id') === selectedEventId ? 'selected' : ''}" data-event-id="${item.get('id')}">
            <span class="event-label">${escapeHtml(item.get('title'))}</span>
            <div class="event-badges">${renderEventBadges(item)}</div>
            <span class="event-dot">•</span>
          </div>
        `)
        .join('');

      cells.push(`
        <div class="day-column" data-date="${iso}">
          <div class="day-header">${getShortWeekday(current)}</div>
          <div class="day-body">
            <span class="day-number ${isSelected ? 'selected' : ''}">${current.getDate()}</span>
            ${dateMarkers || '<div class="date-markers empty-marker"></div>'}
            ${cards}
          </div>
        </div>
      `);
    }

    return cells.join('');
  }

  function renderDayView(selectedDate, items, selectedEventId) {
    const current = parseISO(selectedDate);
    const dateMarkers = renderDateMarkers(items, selectedDate);
    const cards = items.filter((item) => selectedDate >= item.get('startDate') && selectedDate <= item.get('endDate'))
      .map((item) => `
        <div class="event-card ${item.get('type')} ${item.get('id') === selectedEventId ? 'selected' : ''}" data-event-id="${item.get('id')}">
          <span class="event-label">${escapeHtml(item.get('title'))}</span>
          <div class="event-badges">${renderEventBadges(item)}</div>
          <span class="event-dot">•</span>
        </div>
      `)
      .join('');

    return `
      <div class="day-column" data-date="${selectedDate}">
        <div class="day-header">${getLongDayName(current)}</div>
        <div class="day-body">
          <span class="day-number selected">${current.getDate()}</span>
          ${dateMarkers || '<div class="date-markers empty-marker"></div>'}
          ${cards || '<div class="empty-state">No events for this day.</div>'}
        </div>
      </div>
    `;
  }

  function renderDetail(selectedDate, items, selectedEventId, isDirty) {
    const match = findEventById(items, selectedEventId)
      || items.find((item) => selectedDate >= item.get('startDate') && selectedDate <= item.get('endDate'));

    if (!match) {
      return '<div class="empty-state">No event selected.</div>';
    }

    const eventTitle = `${escapeHtml(match.get('title'))}${isDirty ? ' *' : ''}`;

    return `
      <div class="detail-title">${eventTitle}</div>

      <div class="detail-field">
        <span class="detail-label">Type</span>
        <div class="type-pill ${match.get('type')}">${match.get('type')}</div>
      </div>

      <div class="detail-field">
        <span class="detail-label">Tags</span>
        <div class="detail-value">${escapeHtml((getEventTags(match).join(', ') || 'No tags'))}</div>
      </div>

      <div class="detail-field">
        <span class="detail-label">Recurrence</span>
        <div class="detail-value">${escapeHtml(getRecurrenceLabel(match.get('recurrence')) || 'Does not repeat')}</div>
      </div>

      <div class="detail-field">
        <span class="detail-label">Date</span>
        <div class="detail-value">${match.get('startDate')} → ${match.get('endDate')}</div>
      </div>

      <div class="detail-field">
        <span class="detail-label">Notes</span>
        <div class="detail-value">${escapeHtml(match.get('notes'))}</div>
      </div>

      <div class="detail-field">
        <button class="secondary-btn" data-edit-event="${match.get('id')}">Edit Event</button>
      </div>
    `;
  }

  function parseISO(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function toISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function offsetDate(dateString, deltaDays) {
    const d = parseISO(dateString);
    d.setDate(d.getDate() + deltaDays);
    return toISODate(d);
  }

  function diffDays(dateA, dateB) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.round((dateA.getTime() - dateB.getTime()) / msPerDay);
  }

  function formatMonthYear(dateString) {
    const d = parseISO(dateString);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function getShortWeekday(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function getLongDayName(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function findEventById(items, eventId) {
    if (!eventId) return null;
    return items.find((item) => item.get('id') === eventId) || null;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  render();
})();
