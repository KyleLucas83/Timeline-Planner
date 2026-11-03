(function () {
  'use strict';

  const root = document.getElementById('app');
  if (!root) return;

  const immutable = window.Immutable;
  if (!immutable) {
    const message = document.createElement('div');
    message.style.cssText = 'padding:20px;color:#b00;';
    message.textContent = 'Immutable.js is required.';
    root.replaceChildren(message);
    return;
  }

  const { fromJS } = immutable;
  const STORAGE_KEY = 'timeline-planner-state-v1';
  const THEME_KEY = 'timeline-planner-theme';
  const VIEW_KEY = 'timeline-planner-view';
  const SQL_JS_ASSETS = 'assets/vendor/';
  const VALID_TYPES = new Set(['work', 'personal', 'health', 'travel', 'deadline']);
  let lastStatusText = 'Saved';
  let sliderDrag = null;
  let sqlJsPromise = null;
  let handlersBound = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function append(parent, ...children) {
    const fragment = document.createDocumentFragment();
    children.flat(Infinity).filter(Boolean).forEach((child) => fragment.append(child));
    parent.append(fragment);
    return parent;
  }

  function setData(node, key, value) {
    node.setAttribute(`data-${key}`, String(value));
    return node;
  }

  function createButton(label, className, id) {
    const button = element('button', className, label);
    button.type = 'button';
    if (id) button.id = id;
    return button;
  }

  function defaultState() {
    const initialDate = toISODate(new Date());
    return fromJS({
      selectedDate: initialDate,
      selectedEventId: 'evt-2',
      activeTagFilter: 'all',
      view: loadView(),
      modalMode: 'create',
      dragState: null,
      isDirty: false,
      plan: { id: 'plan-main', name: 'Main planner', items: [
        { id: 'evt-1', title: 'Design Review', type: 'work', startDate: offsetDate(initialDate, -2), endDate: offsetDate(initialDate, 2), notes: 'Review timeline structure and UX flow.', tags: ['design', 'planning'], recurrence: 'weekly', status: 'planned' },
        { id: 'evt-2', title: 'Workout', type: 'health', startDate: initialDate, endDate: initialDate, notes: 'Strength session and mobility work.', tags: ['wellness', 'routine'], recurrence: 'weekly', status: 'active' },
        { id: 'evt-3', title: 'Trip Planning', type: 'travel', startDate: offsetDate(initialDate, 5), endDate: offsetDate(initialDate, 8), notes: 'Finalize flights and lodging.', tags: ['travel', 'planning'], recurrence: 'monthly', status: 'planned' },
        { id: 'evt-4', title: 'Project Deadline', type: 'deadline', startDate: offsetDate(initialDate, 12), endDate: offsetDate(initialDate, 15), notes: 'Final handoff package due.', tags: ['deadline', 'critical'], recurrence: 'none', status: 'urgent' }
      ] }
    });
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? fromJS(normalizeState(JSON.parse(raw))) : defaultState();
    } catch (error) {
      console.warn('Could not load timeline state:', error);
      return defaultState();
    }
  }

  function normalizeState(payload, preferStoredView = true) {
    const defaults = defaultState().toJS();
    const canonical = payload && payload.data && payload.customizations;
    const legacy = canonical ? {} : (payload && payload.state ? payload.state : payload);
    const plan = canonical ? payload.data.plan : legacy && legacy.plan;
    if (!plan || !Array.isArray(plan.items)) throw new Error('The saved timeline data is missing its planner events.');
    const settings = canonical ? payload.settings || {} : {};
    const custom = canonical ? payload.customizations : {};
    const savedView = canonical ? settings.view : legacy && legacy.view;
    const theme = custom.theme || (payload && payload.theme) || loadTheme();
    return {
      ...defaults, ...legacy, plan,
      selectedDate: custom.activeDate || (legacy && legacy.selectedDate) || defaults.selectedDate,
      selectedEventId: custom.selectedEventId !== undefined ? custom.selectedEventId : (legacy && legacy.selectedEventId !== undefined ? legacy.selectedEventId : defaults.selectedEventId),
      activeTagFilter: custom.activeTagFilter || (legacy && legacy.activeTagFilter) || 'all',
      view: preferStoredView ? loadView(['month', 'week', 'day'].includes(savedView) ? savedView : defaults.view) : (['month', 'week', 'day'].includes(savedView) ? savedView : loadView(defaults.view)),
      theme: ['standard', 'dark', 'forest', 'sky'].includes(theme) ? theme : 'standard',
      modalMode: 'create', dragState: null, isDirty: false
    };
  }

  function buildSaveBundle(sourceState = state) {
    const current = sourceState.toJS();
    return {
      schemaVersion: 1, exportedAt: new Date().toISOString(), data: { plan: current.plan },
      settings: { view: current.view },
      customizations: { theme: loadTheme(), activeDate: current.selectedDate, selectedEventId: current.selectedEventId, activeTagFilter: current.activeTagFilter }
    };
  }

  function initializeSqlJs() {
    if (!sqlJsPromise) {
      if (typeof window.initSqlJs !== 'function') return Promise.reject(new Error('SQLite support could not be loaded. Check your connection and try again.'));
      sqlJsPromise = window.initSqlJs({ locateFile: (file) => `${SQL_JS_ASSETS}${file}` }).catch((error) => { sqlJsPromise = null; throw error; });
    }
    return sqlJsPromise;
  }

  function loadTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'standard'; } catch (error) { return 'standard'; }
  }

  function loadView(fallback = 'month') {
    try { const view = localStorage.getItem(VIEW_KEY); return ['month', 'week', 'day'].includes(view) ? view : fallback; } catch (error) { return fallback; }
  }

  function saveState(nextState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSaveBundle(nextState))); }

  function downloadFile(content, mimeType, filename) {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function readSqliteBundle(file) {
    const SQL = await initializeSqlJs();
    const db = new SQL.Database(new Uint8Array(await file.arrayBuffer()));
    try {
      const results = db.exec('SELECT payload FROM timeline_data WHERE id = 1');
      if (!results.length || !results[0].values.length) throw new Error('The SQLite file does not contain a saved timeline plan.');
      return JSON.parse(results[0].values[0][0]);
    } finally { db.close(); }
  }

  function setStatus(text, warning) {
    lastStatusText = text;
    const status = document.getElementById('save-status');
    if (status) { status.textContent = text; status.classList.toggle('warn', !!warning); }
  }

  function applyTheme(theme) {
    const name = ['standard', 'dark', 'forest', 'sky'].includes(theme) ? theme : 'standard';
    document.body.setAttribute('data-theme', name);
    try { localStorage.setItem(THEME_KEY, name); } catch (error) { console.warn('Could not save selected theme:', error); }
  }

  function saveView(view) { try { localStorage.setItem(VIEW_KEY, view); } catch (error) { console.warn('Could not save selected view:', error); } }
  function markDirty() { state = state.set('isDirty', true); setStatus('Unsaved changes', true); }
  function clearDirty() { state = state.set('isDirty', false); setStatus('Saved', false); }
  let state = loadState();

  function getEventTags(item) {
    if (!item) return [];
    const tags = item.get('tags');
    if (Array.isArray(tags)) return tags.filter(Boolean).map((tag) => String(tag).trim()).filter(Boolean);
    if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    return [];
  }

  function getRecurrenceLabel(value) {
    return ({ weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' })[value] || (value && value !== 'none' ? String(value) : '');
  }

  function getAllTags(items) {
    const tags = new Set();
    items.forEach((item) => getEventTags(item).forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }

  function getVisibleItems(items, filter) { return !filter || filter === 'all' ? items : items.filter((item) => getEventTags(item).includes(filter)); }
  function getSliderStepDays(view) { return view === 'day' ? 1 : view === 'week' ? 7 : 30; }
  function getTimelineBubblePercent(index) { return ((index + 6) / 12) * 100; }
  function getNearestBubbleIndex(percent) { return clamp(Math.round((percent / 100) * 12 - 6), -6, 6); }

  function buildTimelineLabels(selectedDate, view) {
    const fragment = document.createDocumentFragment();
    for (let index = -6; index <= 6; index += 1) {
      const bubble = element('div', `timeline-bubble ${index === 0 ? 'center' : (index % 2 === 0 ? 'below' : 'above')}`, formatTimelineLabel(offsetDate(selectedDate, index * getSliderStepDays(view)), view));
      bubble.style.left = `${getTimelineBubblePercent(index)}%`;
      fragment.append(bubble);
    }
    return fragment;
  }

  function formatTimelineLabel(dateString, view) {
    const date = parseISO(dateString);
    return date.toLocaleDateString('en-US', view === 'month' ? { month: 'short' } : { month: 'short', day: 'numeric' });
  }

  function renderTagFilters(items) {
    const wrapper = element('div', 'filter-row');
    const fragment = document.createDocumentFragment();
    ['all', ...getAllTags(items)].forEach((tag) => {
      const chip = createButton(tag === 'all' ? 'All' : tag, `tag-filter-chip${tag === (state.get('activeTagFilter') || 'all') ? ' selected' : ''}`);
      setData(chip, 'tag-filter', tag);
      fragment.append(chip);
    });
    wrapper.append(fragment);
    return wrapper;
  }

  function renderDateMarkers(items, dateString) {
    const starts = items.filter((item) => item.get('startDate') === dateString);
    const markers = element('div', `date-markers${starts.length ? '' : ' empty-marker'}`);
    if (!starts.length) return markers;
    markers.setAttribute('aria-label', `${starts.length} event${starts.length > 1 ? 's' : ''} on this date`);
    const fragment = document.createDocumentFragment();
    starts.forEach((item) => {
      const type = VALID_TYPES.has(item.get('type')) ? item.get('type') : 'work';
      const title = String(item.get('title') || '');
      const marker = element('span', `timeline-marker ${type}`);
      marker.title = title; marker.setAttribute('aria-label', title);
      fragment.append(marker);
    });
    markers.append(fragment);
    return markers;
  }

  function renderEventBadges(item) {
    const badges = document.createDocumentFragment();
    const tags = getEventTags(item);
    if (tags.length) badges.append(element('span', 'meta-badge tag', tags[0]));
    const recurrence = getRecurrenceLabel(item.get('recurrence'));
    if (recurrence) badges.append(element('span', 'meta-badge recurrence', recurrence));
    return badges;
  }

  function createEventCard(item, selectedEventId) {
    const type = VALID_TYPES.has(item.get('type')) ? item.get('type') : 'work';
    const card = element('div', `event-card ${type}${item.get('id') === selectedEventId ? ' selected' : ''}`);
    setData(card, 'event-id', item.get('id'));
    const label = element('span', 'event-label', item.get('title') || 'Untitled event');
    const badges = element('div', 'event-badges'); badges.append(renderEventBadges(item));
    append(card, label, badges, element('span', 'event-dot', '•'));
    return card;
  }

  function createDayColumn(date, items, selectedDate, selectedEventId, options = {}) {
    const iso = toISODate(date);
    const column = element('div', 'day-column'); setData(column, 'date', iso);
    const body = element('div', 'day-body');
    const selected = iso === selectedDate;
    const isToday = iso === toISODate(new Date());
    const numberClasses = ['day-number', isToday ? 'today' : '', selected ? 'selected' : '', options.outsideMonth ? 'outside-month' : ''].filter(Boolean).join(' ');
    append(column, element('div', 'day-header', options.longName ? getLongDayName(date) : getShortWeekday(date)));
    body.append(element('span', numberClasses, date.getDate()));
    body.append(renderDateMarkers(items, iso));
    const dailyItems = items.filter((item) => iso >= item.get('startDate') && iso <= item.get('endDate'));
    const cards = document.createDocumentFragment();
    dailyItems.forEach((item) => cards.append(createEventCard(item, selectedEventId)));
    if (!dailyItems.length && options.showEmpty) cards.append(element('div', 'empty-state', 'No events for this day.'));
    body.append(cards); column.append(body);
    return column;
  }

  function renderCurrentView(view, selectedDate, items, selectedEventId) {
    const wrapper = element('div', view === 'day' ? 'day-grid' : view === 'week' ? 'week-grid' : 'month-grid');
    const selected = parseISO(selectedDate);
    const fragment = document.createDocumentFragment();
    if (view === 'day') {
      fragment.append(createDayColumn(selected, items, selectedDate, selectedEventId, { longName: true, showEmpty: true }));
    } else if (view === 'week') {
      const start = new Date(selected);
      start.setDate(selected.getDate() - ((selected.getDay() + 6) % 7));
      for (let i = 0; i < 7; i += 1) {
        const date = new Date(start); date.setDate(start.getDate() + i);
        fragment.append(createDayColumn(date, items, selectedDate, selectedEventId));
      }
    } else {
      const monthStart = new Date(selected.getFullYear(), selected.getMonth(), 1);
      const leading = monthStart.getDay();
      for (let i = 0; i < 42; i += 1) {
        const date = new Date(selected.getFullYear(), selected.getMonth(), i - leading + 1);
        fragment.append(createDayColumn(date, items, selectedDate, selectedEventId, { outsideMonth: date.getMonth() !== selected.getMonth() }));
      }
    }
    wrapper.append(fragment);
    return wrapper;
  }

  function renderDetail(selectedDate, items, selectedEventId, isDirty) {
    const card = element('div', 'detail-card');
    const match = findEventById(items, selectedEventId) || items.find((item) => selectedDate >= item.get('startDate') && selectedDate <= item.get('endDate'));
    if (!match) { card.append(element('div', 'empty-state', 'No event selected.')); return card; }
    const type = VALID_TYPES.has(match.get('type')) ? match.get('type') : 'work';
    card.append(element('div', 'detail-title', `${match.get('title') || 'Untitled event'}${isDirty ? ' *' : ''}`));
    const fields = [
      ['Type', () => element('div', `type-pill ${type}`, type)],
      ['Tags', () => element('div', 'detail-value', getEventTags(match).join(', ') || 'No tags')],
      ['Recurrence', () => element('div', 'detail-value', getRecurrenceLabel(match.get('recurrence')) || 'Does not repeat')],
      ['Date', () => element('div', 'detail-value', `${match.get('startDate')} → ${match.get('endDate')}`)],
      ['Notes', () => element('div', 'detail-value', match.get('notes') || 'No notes.')]
    ];
    fields.forEach(([label, createValue]) => {
      const field = element('div', 'detail-field'); append(field, element('span', 'detail-label', label), createValue()); card.append(field);
    });
    const action = element('div', 'detail-field');
    const edit = createButton('Edit Event', 'secondary-btn'); setData(edit, 'edit-event', match.get('id')); action.append(edit); card.append(action);
    return card;
  }

  function render() {
    const selectedDate = state.get('selectedDate');
    const view = state.get('view');
    const items = state.getIn(['plan', 'items']);
    const visibleItems = getVisibleItems(items, state.get('activeTagFilter'));
    const selectedEventId = state.get('selectedEventId');
    const isDirty = !!state.get('isDirty');
    const handlePercent = sliderDrag ? sliderDrag.handlePercent : 50;
    const app = element('div', 'timeline-app');
    const topbar = element('header', 'topbar');
    const left = element('div', 'topbar-left');
    const brand = document.createElement('img'); brand.className = 'brand'; brand.src = 'assets/goodomens-titlebar.svg'; brand.alt = 'GoodOmens Timeline Planner';
    const toggle = element('div', 'view-toggle');
    ['month', 'week', 'day'].forEach((name) => {
      const button = createButton(name[0].toUpperCase() + name.slice(1), `view-button${view === name ? ' active' : ''}`);
      setData(button, 'view', name); toggle.append(button);
    });
    append(left, brand, toggle);
    const right = element('div', 'topbar-right');
    const themeWrap = element('div', 'theme-selector');
    const themeLabel = element('label', '', 'Theme'); themeLabel.htmlFor = 'theme-select';
    const themeSelect = document.createElement('select'); themeSelect.id = 'theme-select';
    [['standard', 'Standard'], ['dark', 'Dark Theme'], ['forest', 'Forest Theme'], ['sky', 'Sky Theme']].forEach(([value, label]) => {
      const option = element('option', '', label); option.value = value; themeSelect.append(option);
    });
    append(themeWrap, themeLabel, themeSelect);
    const status = element('div', `save-status${isDirty ? ' warn' : ''}`, isDirty ? 'Unsaved changes' : lastStatusText); status.id = 'save-status';
    const save = createButton('Save Local', 'save-btn', 'save-plan-btn');
    const exportJson = createButton('Save JSON', 'export-btn', 'export-json-btn');
    const exportSqlite = createButton('Save SQLite', 'export-btn', 'export-sqlite-btn');
    const importButton = createButton('Import', 'import-btn', 'import-json-btn');
    const importInput = document.createElement('input'); importInput.type = 'file'; importInput.id = 'json-import-input'; importInput.className = 'hidden'; importInput.accept = '.json,.sqlite,.sqlite3,.db,application/json,application/x-sqlite3';
    const newItem = createButton('+ New Event', 'primary-btn', 'new-item-btn');
    append(right, themeWrap, status, save, exportJson, exportSqlite, importButton, importInput, newItem);
    append(topbar, left, right);
    app.append(topbar, renderTagFilters(items));

    const shell = element('div', 'planner-shell');
    const toolbar = element('div', 'timeline-toolbar');
    append(toolbar, element('div', 'period-label', formatMonthYear(selectedDate)), element('div', 'period-label', selectedDate));
    const rail = element('div', 'focus-rail'); rail.id = 'focus-rail';
    const labels = element('div', 'timeline-labels'); labels.append(buildTimelineLabels(selectedDate, view));
    const line = element('div', 'focus-line'); line.style.left = `${handlePercent}%`;
    const handle = element('div', 'focus-handle'); handle.id = 'focus-handle'; handle.style.left = `${handlePercent}%`;
    append(rail, labels, element('div', 'focus-track'), line, handle);
    append(shell, toolbar, rail, renderCurrentView(view, selectedDate, visibleItems, selectedEventId));
    app.append(shell);
    const detailPanel = element('div', 'detail-panel'); detailPanel.append(renderDetail(selectedDate, items, selectedEventId, isDirty)); app.append(detailPanel);
    root.replaceChildren(app);

    applyTheme(loadTheme());
    themeSelect.value = loadTheme();
    bindHandlers();
  }

  function bindHandlers() {
    if (handlersBound) return;
    handlersBound = true;

    root.addEventListener('click', (event) => {
      const target = event.target;
      const viewButton = target.closest('[data-view]');
      if (viewButton) { const view = viewButton.dataset.view; state = state.set('view', view); saveView(view); sliderDrag = null; render(); return; }
      const tagChip = target.closest('[data-tag-filter]');
      if (tagChip) { state = state.set('activeTagFilter', tagChip.dataset.tagFilter || 'all'); render(); return; }
      if (target.closest('#new-item-btn')) { openModal('create', state.get('selectedDate')); return; }
      if (target.closest('#save-plan-btn')) {
        const next = state.set('isDirty', false);
        try { saveState(next); state = next; clearDirty(); render(); }
        catch (error) { console.error('Could not save timeline data to localStorage:', error); setStatus('Local save failed', true); }
        return;
      }
      if (target.closest('#export-json-btn')) {
        try { downloadFile(JSON.stringify(buildSaveBundle(), null, 2), 'application/json', 'timeline-planner.json'); setStatus('Saved JSON file'); }
        catch (error) { console.error('Could not export timeline JSON:', error); setStatus('JSON save failed', true); }
        return;
      }
      if (target.closest('#export-sqlite-btn')) { exportSqlite(); return; }
      if (target.closest('#import-json-btn')) { document.getElementById('json-import-input')?.click(); return; }
      const edit = target.closest('[data-edit-event]');
      if (edit) { openModal('edit', state.get('selectedDate'), edit.dataset.editEvent); return; }
      const card = target.closest('.event-card');
      if (card) {
        const id = card.dataset.eventId; state = state.set('selectedEventId', id);
        const item = findEventById(state.getIn(['plan', 'items']), id);
        if (item) state = state.set('selectedDate', item.get('startDate'));
        render();
      }
    });

    root.addEventListener('change', async (event) => {
      if (event.target.id === 'theme-select') { applyTheme(event.target.value); return; }
      if (event.target.id !== 'json-import-input') return;
      const input = event.target;
      const file = input.files && input.files[0]; input.value = '';
      if (!file) return;
      try {
        const sqlite = /\.(sqlite|sqlite3|db)$/i.test(file.name) || file.type === 'application/x-sqlite3';
        const payload = sqlite ? await readSqliteBundle(file) : JSON.parse(await file.text());
        state = fromJS(normalizeState(payload, false)); applyTheme(state.get('theme')); saveView(state.get('view')); markDirty(); render(); setStatus('Imported; save to keep', true);
      } catch (error) { console.error('Import failed:', error); setStatus('Import failed', true); }
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-close="modal"]')) { closeModal(); return; }
      const card = event.target.closest('.event-card');
      if (card && !root.contains(card)) return;
      if (card && event.detail > 1) openModal('edit', state.get('selectedDate'), card.dataset.eventId);
    });

    root.addEventListener('pointerdown', (event) => {
      const handle = event.target.closest('#focus-handle');
      if (handle) { sliderDrag = { baseDate: state.get('selectedDate'), handlePercent: 50 }; event.preventDefault(); return; }
      const card = event.target.closest('.event-card');
      if (!card) return;
      const item = findEventById(state.getIn(['plan', 'items']), card.dataset.eventId);
      if (!item) return;
      state = state.set('selectedEventId', card.dataset.eventId).set('dragState', fromJS({ eventId: card.dataset.eventId, originalStartDate: item.get('startDate'), originalEndDate: item.get('endDate') }));
      card.classList.add('dragging');
      if (card.setPointerCapture) card.setPointerCapture(event.pointerId);
    });

    document.addEventListener('pointermove', (event) => {
      if (sliderDrag) {
        const rail = document.getElementById('focus-rail'); if (!rail) return;
        const rect = rail.getBoundingClientRect();
        const pos = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
        const index = getNearestBubbleIndex(pos);
        state = state.set('selectedDate', offsetDate(sliderDrag.baseDate, index * getSliderStepDays(state.get('view'))));
        sliderDrag.handlePercent = getTimelineBubblePercent(index); render(); return;
      }
      const drag = state.get('dragState'); if (!drag) return;
      const column = document.elementFromPoint(event.clientX, event.clientY)?.closest('.day-column');
      const date = column && column.dataset.date; if (!date) return;
      const item = findEventById(state.getIn(['plan', 'items']), drag.get('eventId')); if (!item) return;
      const delta = diffDays(parseISO(date), parseISO(drag.get('originalStartDate')));
      const duration = diffDays(parseISO(drag.get('originalEndDate')), parseISO(drag.get('originalStartDate'))) + 1;
      const start = offsetDate(drag.get('originalStartDate'), delta); const end = offsetDate(start, duration - 1);
      if (item.get('startDate') === start && item.get('endDate') === end) return;
      state = state.updateIn(['plan', 'items'], (items) => items.map((entry) => entry.get('id') === drag.get('eventId') ? entry.set('startDate', start).set('endDate', end) : entry));
      state = state.set('selectedDate', start); markDirty(); render();
    });

    document.addEventListener('pointerup', () => {
      if (sliderDrag) { sliderDrag = null; render(); return; }
      document.querySelectorAll('.event-card.dragging').forEach((node) => node.classList.remove('dragging'));
      if (state.get('dragState')) state = state.set('dragState', null);
    });

    const form = document.getElementById('event-form');
    if (form) form.addEventListener('submit', (event) => {
      event.preventDefault();
      const id = form.elements.eventId.value || `evt-${Date.now()}`;
      const title = form.elements.title.value.trim();
      const type = form.elements.type.value;
      const startDate = form.elements.startDate.value;
      const endDate = form.elements.endDate.value;
      const notes = form.elements.notes.value.trim() || 'No notes.';
      const tags = form.elements.tags.value.split(',').map((tag) => tag.trim()).filter(Boolean);
      const recurrence = form.elements.recurrence.value || 'none';
      const status = form.elements.status.value || 'planned';
      if (!title) { alert('Please enter an event title.'); return; }
      if (!startDate || !endDate) { alert('Please choose both dates.'); return; }
      if (startDate > endDate) { alert('End date cannot be before start date.'); return; }
      const values = { title, type, startDate, endDate, notes, tags, recurrence, status };
      if (form.dataset.mode === 'edit') {
        state = state.updateIn(['plan', 'items'], (items) => items.map((item) => {
          if (item.get('id') !== id) return item;
          return Object.entries(values).reduce((next, [key, value]) => next.set(key, key === 'tags' ? fromJS(value) : value), item);
        }));
      } else {
        state = state.updateIn(['plan', 'items'], (items) => items.push(fromJS({ id, ...values })));
      }
      state = state.set('selectedEventId', id).set('selectedDate', startDate); markDirty(); closeModal(); render();
    });

    const deleteButton = document.getElementById('delete-event-btn');
    if (deleteButton) deleteButton.addEventListener('click', () => {
      const id = document.getElementById('event-id').value; if (!id) return;
      state = state.updateIn(['plan', 'items'], (items) => items.filter((item) => item.get('id') !== id)).set('selectedEventId', null);
      markDirty(); closeModal(); render();
    });
  }

  async function exportSqlite() {
    let db;
    try {
      const SQL = await initializeSqlJs(); db = new SQL.Database();
      db.run('CREATE TABLE timeline_data (id INTEGER PRIMARY KEY, payload TEXT NOT NULL)');
      db.run('INSERT INTO timeline_data (id, payload) VALUES (?, ?)', [1, JSON.stringify(buildSaveBundle())]);
      downloadFile(db.export(), 'application/x-sqlite3', 'timeline-planner.sqlite'); setStatus('Saved SQLite file');
    } catch (error) { console.error('Could not export timeline SQLite database:', error); setStatus('SQLite save failed', true); }
    finally { if (db) db.close(); }
  }

  function openModal(mode, selectedDate, eventId) {
    const modal = document.getElementById('event-modal'); const form = document.getElementById('event-form');
    const title = document.getElementById('event-title'); const type = document.getElementById('event-type');
    const start = document.getElementById('event-start'); const end = document.getElementById('event-end');
    const notes = document.getElementById('event-notes'); const tags = document.getElementById('event-tags');
    const recurrence = document.getElementById('event-recurring'); const status = document.getElementById('event-status');
    const idInput = document.getElementById('event-id'); const deleteBtn = document.getElementById('delete-event-btn');
    if (!modal || !form || !title || !type || !start || !end || !notes || !tags || !recurrence || !status || !idInput) return;
    form.dataset.mode = mode;
    if (mode === 'edit' && eventId) {
      const item = findEventById(state.getIn(['plan', 'items']), eventId); if (!item) return;
      document.getElementById('event-modal-title').textContent = 'Edit Event';
      idInput.value = item.get('id'); title.value = item.get('title'); type.value = item.get('type') || 'work';
      start.value = item.get('startDate'); end.value = item.get('endDate'); notes.value = item.get('notes');
      tags.value = getEventTags(item).join(', '); recurrence.value = item.get('recurrence') || 'none'; status.value = item.get('status') || 'planned';
      if (deleteBtn) deleteBtn.classList.remove('hidden');
    } else {
      document.getElementById('event-modal-title').textContent = 'Create Event'; form.reset(); idInput.value = '';
      type.value = 'work'; recurrence.value = 'none'; status.value = 'planned';
      start.value = selectedDate || state.get('selectedDate'); end.value = selectedDate || state.get('selectedDate');
      if (deleteBtn) deleteBtn.classList.add('hidden');
    }
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden', 'false'); setTimeout(() => title.focus(), 30);
  }

  function closeModal() {
    const modal = document.getElementById('event-modal'); const form = document.getElementById('event-form');
    if (modal) { modal.classList.add('hidden'); modal.setAttribute('aria-hidden', 'true'); }
    if (form) { form.reset(); form.dataset.mode = 'create'; }
    document.getElementById('delete-event-btn')?.classList.add('hidden');
  }

  function parseISO(value) { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
  function toISODate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function offsetDate(value, days) { const date = parseISO(value); date.setDate(date.getDate() + days); return toISODate(date); }
  function diffDays(a, b) { return Math.round((a.getTime() - b.getTime()) / 86400000); }
  function formatMonthYear(value) { return parseISO(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  function getShortWeekday(date) { return date.toLocaleDateString('en-US', { weekday: 'short' }); }
  function getLongDayName(date) { return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }); }
  function findEventById(items, id) { return id ? items.find((item) => item.get('id') === id) || null : null; }
  function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }

  render();
})();
