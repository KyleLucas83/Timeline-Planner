(function () {
  'use strict';

  const root = document.getElementById('app');
  if (!root) return;

  const immutable = window.Immutable;
  if (!immutable) {
    root.innerHTML = '<div style="padding:24px;color:#d00;">Immutable.js is required.</div>';
    return;
  }

  const { Map, List, fromJS } = immutable;

  const today = new Date();
  const initialDate = toISODate(today);

  const initialState = fromJS({
    selectedDate: initialDate,
    view: 'month',
    plan: {
      id: 'plan-main',
      name: 'Main planner',
      items: [
        {
          id: 'evt-1',
          title: 'Design Review',
          type: 'work',
          startDate: monthDateOffset(initialDate, -2),
          endDate: monthDateOffset(initialDate, 2),
          notes: 'Review UX and timeline structure.',
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
          startDate: monthDateOffset(initialDate, 5),
          endDate: monthDateOffset(initialDate, 8),
          notes: 'Finalize flights and bookings.',
          status: 'planned'
        },
        {
          id: 'evt-4',
          title: 'Project Deadline',
          type: 'deadline',
          startDate: monthDateOffset(initialDate, 11),
          endDate: monthDateOffset(initialDate, 14),
          notes: 'Deliver final handoff package.',
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
            <div class="focus-line" id="focus-line" style="left: ${focusPercent}%"></div>
            <div class="focus-handle" id="focus-handle" style="left: ${focusPercent}%"></div>
          </div>

          <div class="month-grid">
            ${renderView(view, selectedDate, items)}
          </div>
        </div>

        <aside class="detail-panel">
          <div class="detail-card">
            ${renderDetailCard(items, selectedDate)}
          </div>
        </aside>
      </div>
    `;

    bindInteractionHandlers();
  }

  function bindInteractionHandlers() {
    document.querySelectorAll('.view-button').forEach((button) => {
      button.addEventListener('click', () => {
        const nextView = button.dataset.view;
        state = state.set('view', nextView);
        render();
      });
    });

    const focusRail = document.getElementById('focus-rail');
    const focusHandle = document.getElementById('focus-handle');
    if (focusRail && focusHandle) {
      let isDragging = false;

      focusHandle.addEventListener('pointerdown', (event) => {
        isDragging = true;
        focusHandle.setPointerCapture(event.pointerId);
      });

      focusRail.addEventListener('pointermove', (event) => {
        if (!isDragging) return;
        const rect = focusRail.getBoundingClientRect();
        const relativeX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
        const ratio = rect.width === 0 ? 0 : relativeX / rect.width;
        const monthLength = getMonthLength(parseISO(state.get('selectedDate')));
        const offsetDays = Math.round((ratio * 2 - 1) * (monthLength / 2));
        const nextDate = addDays(state.get('selectedDate'), offsetDays);
        state = state.set('selectedDate', nextDate);
        render();
      });

      focusHandle.addEventListener('pointerup', () => {
        isDragging = false;
      });

      focusRail.addEventListener('pointerleave', () => {
        isDragging = false;
      });
    }

    document.getElementById('today-btn').addEventListener('click', () => {
      state = state.set('selectedDate', toISODate(new Date()));
      render();
    });

    document.getElementById('new-item-btn').addEventListener('click', () => {
      // placeholder for later event creation logic
      alert('New event action placeholder');
    });
  }

  function renderView(view, selectedDate, items) {
    if (view === 'week') {
      return renderWeekView(selectedDate, items);
    }
    if (view === 'day') {
      return renderDayView(selectedDate, items);
    }
    return renderMonthView(selectedDate, items);
  }

  function renderMonthView(selectedDate, items) {
    const date = parseISO(selectedDate);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const startOffset = monthStart.getDay();
    const totalDays = getMonthLength(date);
    const gridItems = [];

    for (let i = 0; i < 42; i++) {
      const dayNumber = i - startOffset + 1;
      const cellDate = new Date(date.getFullYear(), date.getMonth(), dayNumber);
      const isoDate = toISODate(cellDate);

      const isCurrentMonth = cellDate.getMonth() === date.getMonth();
      const isSelected = isoDate === selectedDate;
      const isToday = isoDate === toISODate(new Date());
      const cellEvents = items.filter((item) => {
        const start = item.get('startDate');
        const end = item.get('endDate');
        return isoDate >= start && isoDate <= end;
      });

      const cards = cellEvents
        .map((item) => {
          const type = item.get('type');
          const selected = isoDate === selectedDate ? 'selected' : '';
          return `
            <div class="event-card ${type} ${selected}" data-event-id="${item.get('id')}">
              <span class="event-label">${escapeHtml(item.get('title'))}</span>
              <span class="event-dot">•</span>
            </div>
          `;
        })
        .join('');

      gridItems.push(`
        <div class="day-column">
          <div class="day-header">${getShortWeekday(cellDate)}</div>
          <div class="day-body">
            <span class="day-number ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${!isCurrentMonth ? 'outside-month' : ''}">${cellDate.getDate()}</span>
            ${cards}
          </div>
        </div>
      `);
    }

    return gridItems.join('');
  }

  function renderWeekView(selectedDate, items) {
    const start = addDays(selectedDate, -((parseISO(selectedDate).getDay() + 6) % 7));
    const cells = [];

    for (let i = 0; i < 7; i++) {
      const current = addDays(start, i);
      const iso = current;
      const isSelected = iso === selectedDate;
      const cardMarkup = items
        .filter((item) => {
          const startDate = item.get('startDate');
          const endDate = item.get('endDate');
          return iso >= startDate && iso <= endDate;
        })
        .map((item) => `
          <div class="event-card ${item.get('type')} ${isSelected ? 'selected' : ''}">
            <span class="event-label">${escapeHtml(item.get('title'))}</span>
            <span class="event-dot">•</span>
          </div>
        `)
        .join('');

      cells.push(`
        <div class="day-column">
          <div class="day-header">${getShortWeekday(parseISO(current))}</div>
          <div class="day-body">
            <span class="day-number ${isSelected ? 'selected' : ''}">${parseISO(current).getDate()}</span>
            ${cardMarkup}
          </div>
        </div>
      `);
    }

    return cells.join('');
  }

  function renderDayView(selectedDate, items) {
    const selected = parseISO(selectedDate);
    const dayEvents = items.filter((item) => {
      const start = item.get('startDate');
      const end = item.get('endDate');
      return selectedDate >= start && selectedDate <= end;
    });

    const eventMarkup = dayEvents.length
      ? dayEvents.map((item) => `
          <div class="event-card ${item.get('type')} selected">
            <span class="event-label">${escapeHtml(item.get('title'))}</span>
            <span class="event-dot">•</span>
          </div>
        `).join('')
      : '<div class="empty-state">No events for this day.</div>';

    return `
      <div class="day-column" style="grid-column: 1 / -1; min-height: 220px;">
        <div class="day-header">${getLongDayName(selected)}</div>
        <div class="day-body">
          <span class="day-number selected">${selected.getDate()}</span>
          ${eventMarkup}
        </div>
      </div>
    `;
  }

  function renderDetailCard(items, selectedDate) {
    const item = items.find((entry) => {
      const start = entry.get('startDate');
      const end = entry.get('endDate');
      return selectedDate >= start && selectedDate <= end;
    });

    if (!item) {
      return `
        <div class="empty-state">No event selected for this date.</div>
      `;
    }

    return `
      <div class="detail-title">${escapeHtml(item.get('title'))}</div>

      <div class="detail-field">
        <span class="detail-label">Type</span>
        <div class="type-pill ${item.get('type')}">${item.get('type')}</div>
      </div>

      <div class="detail-field">
        <span class="detail-label">Date</span>
        <div class="detail-value">${item.get('startDate')} → ${item.get('endDate')}</div>
      </div>

      <div class="detail-field">
        <span class="detail-label">Notes</span>
        <div class="detail-value">${escapeHtml(item.get('notes'))}</div>
      </div>
    `;
  }

  function getFocusPercent(selectedDate) {
    const date = parseISO(selectedDate);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthLength = getMonthLength(date);
    const dayNumber = date.getDate();
    const offset = dayNumber - 1;
    return (offset / Math.max(monthLength - 1, 1)) * 100;
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

  function monthDateOffset(baseDate, offsetDays) {
    const date = parseISO(baseDate);
    date.setDate(date.getDate() + offsetDays);
    return toISODate(date);
  }

  function addDays(dateString, offset) {
    const date = parseISO(dateString);
    date.setDate(date.getDate() + offset);
    return toISODate(date);
  }

  function formatMonthYear(dateValue) {
    const value = parseISO(dateValue);
    return value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function getShortWeekday(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function getLongDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
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
