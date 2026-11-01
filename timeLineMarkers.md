# timeLineMarkers.md

## Goal

Show event markers for the currently displayed date range using only each event's start date, with narrow vertical bars colored by event type. When multiple events start on the same date, stack the markers inside that day's cell instead of overlapping them.

## Suggested implementation

Add a small helper that renders marker bars for each event whose `startDate` matches the cell date.

```javascript
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
```

Then call it from each day cell before the event list is rendered:

```javascript
const dateMarkers = renderDateMarkers(items, iso);

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
```

## CSS

```css
.date-markers {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 12px;
  flex-wrap: wrap;
  margin: 2px 0 6px;
}

.timeline-marker {
  width: 4px;
  height: 12px;
  border-radius: 999px;
  display: inline-block;
  flex: 0 0 auto;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.timeline-marker.work { background: #aecbff; }
.timeline-marker.personal { background: #a7e7c8; }
.timeline-marker.health { background: #f8d8a3; }
.timeline-marker.travel { background: #d6b8ff; }
.timeline-marker.deadline { background: #f5b8c6; }
```

## Why this is the right pattern

- Only the start date is used for marker placement, which avoids the visual collision and overlap that happen when range-based drawing is mixed with single-day markers.
- It keeps the UI data-driven: a day cell simply renders any events that begin on that date.
- Stacking is handled by flex-wrap, which is simpler and more robust than custom positioning logic.
- Type colors remain consistent with the rest of the app and can be reused in other view states.

## Best practical modern approach

For a modern codebase, the best practical pattern is:

1. Keep a single source of truth for events in app state.
2. Derive visible markers with a pure selector function such as `getEventsForDate(items, iso)`.
3. Render from data, not from ad hoc DOM mutations.
4. Keep styling in CSS classes, not inline style hacks.
5. If this app grows, move to a small framework (React/Vue/Svelte) and treat date marker rendering as a pure component that receives `items` and `date` as props.

That gives you:

- predictable rendering
- minimal state bugs
- easy refactoring
- better accessibility and testability

The plain JavaScript version above is still the most practical for this repo because it matches the current architecture, keeps the change local, and avoids introducing a framework for a small app.
