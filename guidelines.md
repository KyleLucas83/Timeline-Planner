# GoodOmens Timeline Planner Guidelines

## Project identity
- Product name: GoodOmens
- App type: Timeline Planner
- Brand tone: clean, modern, calm, optimistic, practical
- Use the GoodOmens name consistently in UI text, docs, and release references
- Do not reintroduce the older "Timeline Planner" naming in the product surface unless it is clearly a technical or file-system label

## Core purpose
GoodOmens helps a user organize future commitments, milestones, and agenda items in a simple timeline view without friction. The product should feel lightweight, dependable, and easy to understand at a glance.

## Core planning rules
1. Every event must have a title.
2. Every event must have a start date.
3. End date must be equal to or after the start date.
4. Events should be visible in the correct date range across month, week, and day views.
5. The selected date and selected event should stay synchronized when a user clicks or edits an item.
6. Unsaved edits should be clearly indicated with a visible dirty state.
7. Saving should not reset the user context unexpectedly.
8. Import/export should preserve plan data and theme state without breaking the current timeline.

## Timeline behavior rules
- Dates should be treated as calendar dates, not timestamps.
- All date comparisons should use normalized ISO date strings.
- A single event may span multiple days.
- A day view should show all events that fall on that date.
- Dragging an event should move the full date range by the same delta.
- The timeline is a draggable slider that shifts the displayed calendar forward and backwards to a different month, week or day depending on the current display.
- When an event is edited, the timeline should immediately reflect the updated dates and title.
- Empty dates should remain readable and calm; avoid cluttered or visually noisy layouts.

## View rules
### Month view
- Show a full month grid with a clear current month context.
- Use compact event chips and preserve readability.
- The selected day should be visually distinct.
- Outside-month cells should remain secondary but legible.

### Week view
- Show seven days in a consistent order.
- Keep events readable without horizontal overflow issues.
- The selected date should remain clearly highlighted.

### Day view
- Focus on one date at a time.
- Show all events scheduled for that date in a straightforward, scannable list.
- If no events exist, show a clear empty state.

## Interaction rules
- Click an event to select it.
- Double-click an event to open edit mode.
- Dragging should feel predictable and immediate.
- The timeline slider should allow the user to move forward and backward through time based on the current view.
- Canceling a modal should restore prior UI state without losing unrelated work.
- Only the relevant event should be deleted when the delete action is used.
- Buttons and controls should remain visible and obvious without requiring hover-only interactions.

## Visual style rules
- Use a modern, low-noise interface.
- Keep text readable and spacing consistent.
- Limit visual clutter; the timeline is the priority.
- Color should support meaning, not replace it.
- Use theme variations sparingly and keep the default theme polished.

## Accessibility rules
- Ensure interactive controls are keyboard-accessible where possible.
- All modal forms should provide clear labels.
- Dialogs should expose proper focus behavior.
- Do not rely only on color to communicate urgency or status.
- Use semantic HTML and accessible form patterns.

## Data rules
- Persist planner state in a stable local structure.
- Keep state serializable for export/import.
- Prefer explicit values over hidden assumptions in scheduling logic.
- Preserve the user’s selected date and event when re-rendering the app.
- Treat import data as user-controlled; validate before replacing state.

## Documentation rules
- Update docs when behavior changes materially.
- Keep roadmap and product docs aligned with actual app behavior.
- Do not leave stale names, references, or old status notes in the main project docs.

## Implementation guardrails
- Keep business logic separate from rendering logic where practical.
- Avoid broad rewrites unless the underlying issue is clearly scoped.
- Favor small, reviewable changes over large feature jumps.
- Preserve working behavior when improving UX or refactoring.

## Release checklist
Before shipping a change, confirm:
- branding is still consistent with GoodOmens
- timeline actions still validate correctly
- selected event/date logic is stable
- month/week/day views still render correctly
- save/import/export flows still work
- no stale Timeline Planner naming remains in core user-facing files

## Summary
GoodOmens should feel like a reliable planning tool that makes the next few days and months easier to understand. The product should remain simple, calm, and dependable, with the timeline always doing the heavy lifting while the interface stays light and readable.
