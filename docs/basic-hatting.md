# Basic Hatching

This document is the default working guide for the Timeline Planner repository. Use it as a lightweight operating manual while you think through ideas, prototypes, and feature iterations.

## Purpose

This repo is a local-first planning app for organizing future commitments, milestones, and agenda items. It is intentionally simple: browser-based, static frontend, and designed for fast iteration.

The goal is to keep the project easy to understand, easy to test manually, and easy to evolve without over-engineering too early.

## Repository overview

The repo is structured around a simple static app:

```text
Timeline-Planner/
  README.md                  Product overview and repo entry point
  TimelinePlanner.html       App shell and modal form markup
  TimelinePlanner.css        Styling, themes, layout, and UI interaction states
  TimelinePlanner.js         Planner logic, rendering, drag/drop, persistence
  docs/
    ARCHITECTURE.md          Intended architecture and design principles
    ROADMAP.md              Feature roadmap and delivery phases
    CHANGELOG.md            Release notes and change history
    DECISIONS.md            Key product and engineering decisions
  .github/                  Repository automation and issue templates
```

## Core mental model

When working in this repo, think in layers:

1. UI shell and markup
   - `TimelinePlanner.html`
   - defines the app container, modal form, and DOM structure

2. Styling and theme behavior
   - `TimelinePlanner.css`
   - controls look, layout, themes, spacing, drag states, and responsive behavior

3. App logic and state
   - `TimelinePlanner.js`
   - acts as the main application layer
   - renders month/week/day views
   - handles event creation, editing, deletion
   - manages selected date and selected event
   - supports drag-and-drop rescheduling
   - saves state to browser storage
   - supports import/export

4. Project planning and docs
   - `docs/` is part of the product itself
   - roadmap, architecture, and decisions should guide implementation choices

## Standard development setup

This repository does not require a package install or a backend service.

### Run locally

```bash
cd Timeline-Planner
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/TimelinePlanner.html
```

### Important runtime note

- The app uses `Immutable.js` via CDN.
- Browser localStorage stores the planner data.
- There is no database or server-side persistence in the current repo.

## Standard workflow for iteration

Use this sequence whenever you are exploring a new idea or making a feature change:

1. Start with the roadmap
   - Read `docs/ROADMAP.md`
   - Decide whether the idea is near-term, mid-term, or speculative
   - Choose one small, testable improvement

2. Check architecture intent
   - Read `docs/ARCHITECTURE.md`
   - Keep changes consistent with the current local-first design

3. Identify the correct file
   - UI layout or styling: `TimelinePlanner.css`
   - App behavior or state logic: `TimelinePlanner.js`
   - DOM structure or modal markup: `TimelinePlanner.html`

4. Implement the feature in small scope
   - Avoid broad rewrites unless the problem truly demands it
   - Prefer incremental changes that are easy to reason about

5. Validate manually in the browser
   - Create and edit events
   - Delete events
   - Switch between month/week/day views
   - Drag an event to a new date
   - Refresh the page and confirm state persists
   - Test import/export flows
   - Check that save/dirty-state behavior still works

6. Update documentation if the change matters
   - Update the roadmap if the feature is planned or completed
   - Add notes to `docs/CHANGELOG.md` when relevant
   - Document product decisions in `docs/DECISIONS.md` when they materially change direction

7. Commit in small reviewable units
   - Prefer focused commits over broad “everything” commits
   - Keep the repo understandable by future contributors

## Good habits for this repo

- Keep changes small and testable.
- Prefer native browser behavior when possible.
- Do not add a server layer unless the feature clearly requires it.
- Treat `docs/` as an active product artifact, not dead paperwork.
- If a feature affects the user workflow, verify the experience manually before considering it complete.
- If a change changes the app direction, write it down in the decision log.

## Default iteration pattern

When working through thoughts, use this simple loop:

```text
idea -> roadmap check -> architecture check -> implementation -> browser validation -> docs update -> commit
```

This keeps you aligned with the repo’s intended product maturity and avoids building too much infrastructure before the core workflow is proven.

## Suggested working priorities

At this stage, the repo should generally focus on:

- event creation and editing flow
- timeline usability and clarity
- calendar navigation and date logic
- drag-and-drop scheduling fidelity
- save/import/export reliability
- data validation and edge cases
- clear, minimal UX improvements

Avoid big architectural complexity until the planner workflow is clearly stable and used repeatedly.

## Quality bar

A change is usually ready when all of the following are true:

- it works in the browser without obvious errors
- the scheduling behavior remains intuitive
- the state persists or restores correctly
- the feature is scoped and easy to understand
- relevant docs reflect the new reality if needed

## Final rule

This repo is meant to stay approachable. Keep solutions simple, keep workflows visible, and keep the product roadmap honest.

If a feature feels large, break it into smaller milestones. If a workflow is confusing, simplify it. If a decision affects the app direction, record it in the docs.

That is the standard operating pattern for working inside this repository.
