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

  const today = new Date();
  const initialDate = toISODate(today);

  const initialState = fromJS({
    selectedDate: initialDate,
    selectedEventId: 'evt-2',
    view: 'month',
    dragState: null,
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
          status: 'planned'
        },
        {
          id: 'evt-2',
          title: 'Workout',
          type: 'health',
          startDate: initialDate,
          endDate: initialDate,
          notes: 'Strength session and mobility work.',
          status: 'active'
        },
        {
          id: 'evt-3',
          title: 'Trip Planning',
          type: 'travel',
          startDate: offsetDate(initialDate, 5),
          endDate: offsetDate(initialDate, 8),
          notes: 'Finalize flights and lodging.',
          status: 'planned'
        },
        {
          id: 'evt-4',
          title: 'Project Deadline',
          type: 'deadline',
          startDate: offsetDate(initialDate, 12),
          endDate: offsetDate(initialDate, 15),
          notes: 'Final handoff package due.',
          status: 'urgent'
        }
      ]
    }
  });

  let state = initialState;

  function render() {
    const selectedDate = state.get('selectedDate');
    const view = state.get('view');
    const items = state.getIn(['plan', 'items']);
    const selectedEventId = state.get('selectedEventId');
    const focusPercent = getFocusPercent(selectedDate);

    root.innerHTML = `
      <div class="timeline-app">
        <header class="topbar">
          <div class="topbar-left">
            <div class="brand">Timeline Planner</div>
            <div class="view-toggle">
              <button class="view-button ${view === 'month' ? 'active' : ''}" data-view="month">Month</button>
              <button class="view-button ${view === 'week' ? 'active' : ''}" data-view="week">Week</button>
              <button class="view-button ${view === 'day' ? 'active' : ''}" data-view="day">Day</button>
            </div>
          </div>

          <div class="topbar-right">
            <button class="secondary-btn" id="today-btn">Today</button>
            <button class="primary-btn" id="new-item-btn">+ New Event</button>
          </div>
        </header>

        <div class="planner-shell">
          <div class="timeline-toolbar">
            <div class="period-label">${formatMonthYear(selectedDate)}</div>
            <div class="period-label">${selectedDate}</div>
          </div>

          <div class="focus-rail" id="focus-rail">
            <div class="focus-track"></div>
            <div class="focus-line" style="left: ${focusPercent}%"></div>
            <div class="focus-handle" id="focus-handle" style="left: ${focusPercent}%"></div>
          </div>

          <div class="${view === 'day' ? 'day-grid' : (view === 'week' ? 'week-grid' : 'month-grid')}">
            ${renderCurrentView(view, selectedDate, items, selectedEventId)}
          </div>
        </div>

        <div class="detail-panel">
          <div class="detail-card">
            ${renderDetail(selectedDate, items, selectedEventId)}
          </div>
        </div>
      </div>
    `;

    bindStaticHandlers();
  }

  function bindStaticHandlers() {
    document.querySelectorAll('.view-button').forEach((button) => {
      button.addEventListener('click', () => {
        state = state.set('view', button.dataset.view);
        render();
      });
    });

    document.getElementById('today-btn').addEventListener('click', () => {
      state = state.set('selectedDate', toISODate(new Date()));
      render();
    });

    const newItemButton = document.getElementById('new-item-btn');
    if (newItemButton) {
      newItemButton.addEventListener('click', () => {
        openEventModal(state.get('selectedDate'));
      });
    }

    document.addEventListener('click', (event) => {
      const modalClose = event.target.closest('[data-close="modal"]');
      if (modalClose) {
        closeEventModal();
        return;
      }

      const eventCard = event.target.closest('.event-card');
      if (eventCard) {
        const eventId = eventCard.dataset.eventId;
        state = state.set('selectedEventId', eventId);
        const matched = state.getIn(['plan', 'items']).find((item) => item.get('id') === eventId);
        if (matched) {
          state = state.set('selectedDate', matched.get('startDate'));
        }
        render();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      const eventCard = event.target.closest('.event-card');
      if (!eventCard) return;

      const eventId = eventCard.dataset.eventId;
      const item = state.getIn(['plan', 'items']).find((entry) => entry.get('id') === eventId);
      if (!item) return;

      state = state.set('selectedEventId', eventId);
      state = state.set('dragState', fromJS({
        eventId,
        originalStartDate: item.get('startDate'),
        originalEndDate: item.get('endDate')
      }));
      eventCard.setPointerCapture && eventCard.setPointerCapture(event.pointerId);
    });

    document.addEventListener('pointermove', (event) => {
      const dragState = state.get('dragState');
      if (!dragState) return;

      const column = document.elementFromPoint(event.clientX, event.clientY)?.closest('.day-column');
      if (!column) return;

      const targetDate = column.dataset.date;
      if (!targetDate) return;

      const item = state.getIn(['plan', 'items']).find((entry) => entry.get('id') === dragState.get('eventId'));
      if (!item) return;

      const originalStart = parseISO(dragState.get('originalStartDate'));
      const originalEnd = parseISO(dragState.get('originalEndDate'));
      const targetStart = parseISO(targetDate);
      const deltaDays = diffDays(targetStart, originalStart);
      const duration = diffDays(originalEnd, originalStart) + 1;
      const nextStart = offsetDate(dragState.get('originalStartDate'), deltaDays);
      const nextEnd = offsetDate(nextStart, duration - 1);

      state = state.updateIn(['plan', 'items'], (items) =>
        items.map((entry) => {
          if (entry.get('id') !== dragState.get('eventId')) return entry;
          return entry.set('startDate', nextStart).set('endDate', nextEnd);
        })
      );

      state = state.set('selectedDate', nextStart);
      render();
    });

    document.addEventListener('pointerup', () => {
      state = state.set('dragState', null);
    });

    const form = document.getElementById('event-form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();

        const title = form.title.value.trim();
        const type = form.type.value;
        const startDate = form.startDate.value;
        const endDate = form.endDate.value;
        const notes = form.notes.value.trim() || 'No notes.';

        if (!title) {
          alert('Please enter an event title.');
          return;
        }

        if (!startDate || !endDate) {
          alert('Please choose both start and end dates.');
          return;
        }

        if (startDate > endDate) {
          alert('End date cannot be before start date.');
          return;
        }

        const newEvent = fromJS({
          id: 'evt-' + Date.now(),
          title,
          type,
          startDate,
          endDate,
          notes,
          status: 'planned'
        });

        state = state.updateIn(['plan', 'items'], (items) => items.push(newEvent));
        state = state.set('selectedEventId', newEvent.get('id'));
        state = state.set('selectedDate', startDate);
        closeEventModal();
        render();
      });
    }
  }

  function openEventModal(defaultDate) {
    const modal = document.getElementById('event-modal');
    const startInput = document.getElementById('event-start');
    const endInput = document.getElementById('event-end');

    if (!modal || !startInput || !endInput) return;

    const chosenDate = defaultDate || state.get('selectedDate');
    startInput.value = chosenDate;
    endInput.value = chosenDate;

    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => document.getElementById('event-title').focus(), 20);
  }

  function closeEventModal() {
    const modal = document.getElementById('event-modal');
    const form = document.getElementById('event-form');
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
    if (form) form.reset();
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

      const dateEvents = items.filter((item) => iso >= item.get('startDate') && iso <= item.get('endDate'));

      const cards = dateEvents
        .map((item) => {
          const type = item.get('type');
          const isSelectedEvent = item.get('id') === selectedEventId;
          return `
            <div class="event-card ${type} ${isSelectedEvent ? 'selected' : ''}" data-event-id="${item.get('id')}">
              <span class="event-label">${escapeHtml(item.get('title'))}</span>
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

      const cards = items
        .filter((item) => iso >= item.get('startDate') && iso <= item.get('endDate'))
        .map((item) => `
          <div class="event-card ${item.get('type')} ${item.get('id') === selectedEventId ? 'selected' : ''}" data-event-id="${item.get('id')}">
            <span class="event-label">${escapeHtml(item.get('title'))}</span>
            <span class="event-dot">•</span>
          </div>
        `)
        .join('');

      cells.push(`
        <div class="day-column" data-date="${iso}">
          <div class="day-header">${getShortWeekday(current)}</div>
          <div class="day-body">
            <span class="day-number ${isSelected ? 'selected' : ''}">${current.getDate()}</span>
            ${cards}
          </div>
        </div>
      `);
    }

    return cells.join('');
  }

  function renderDayView(selectedDate, items, selectedEventId) {
    const current = parseISO(selectedDate);
    const cards = items
      .filter((item) => selectedDate >= item.get('startDate') && selectedDate <= item.get('endDate'))
      .map((item) => `
        <div class="event-card ${item.get('type')} ${item.get('id') === selectedEventId ? 'selected' : ''}" data-event-id="${item.get('id')}">
          <span class="event-label">${escapeHtml(item.get('title'))}</span>
          <span class="event-dot">•</span>
        </div>
      `)
      .join('');

    return `
      <div class="day-column" data-date="${selectedDate}">
        <div class="day-header">${getLongDayName(current)}</div>
        <div class="day-body">
          <span class="day-number selected">${current.getDate()}</span>
          ${cards || '<div class="empty-state">No events for this day.</div>'}
        </div>
      </div>
    `;
  }

  function renderDetail(selectedDate, items, selectedEventId) {
    const match = items.find((item) => item.get('id') === selectedEventId)
      || items.find((item) => selectedDate >= item.get('startDate') && selectedDate <= item.get('endDate'));

    if (!match) {
      return '<div class="empty-state">No event selected.</div>';
    }

    return `
      <div class="detail-title">${escapeHtml(match.get('title'))}</div>

      <div class="detail-field">
        <span class="detail-label">Type</span>
        <div class="type-pill ${match.get('type')}">${match.get('type')}</div>
      </div>

      <div class="detail-field">
        <span class="detail-label">Date</span>
        <div class="detail-value">${match.get('startDate')} → ${match.get('endDate')}</div>
      </div>

      <div class="detail-field">
        <span class="detail-label">Notes</span>
        <div class="detail-value">${escapeHtml(match.get('notes'))}</div>
      </div>
    `;
  }

  function getFocusPercent(dateString) {
    const d = parseISO(dateString);
    const monthLength = getMonthLength(d);
    const day = d.getDate();
    const ratio = (day - 1) / Math.max(monthLength - 1, 1);
    return Math.max(0, Math.min(100, ratio * 100));
  }

  function getMonthLength(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  render();
})();
