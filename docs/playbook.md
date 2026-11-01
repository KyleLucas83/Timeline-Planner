# Playbook

This is the second version of the working guide for Timeline Planner. It is meant to be a concise, practical playbook for moving from ideas to small, reviewable iterations.

## Mission

Build a simple, reliable timeline planning tool that helps users organize future commitments, milestones, and agenda items with minimal friction.

This project is intentionally local-first and lightweight. The main principle is: start simple, validate quickly, and only expand complexity when the need is real.

## Repository map

```text
Timeline-Planner/
  README.md                  project description and repo entry point
  TimelinePlanner.html       app shell and modal forms
  TimelinePlanner.css        layout, theming, and UI behavior
  TimelinePlanner.js         planner logic, render cycle, state updates, storage
  docs/
    ARCHITECTURE.md          high-level system intent
    ROADMAP.md              product plan and milestone tracking
    CHANGELOG.md            release and iteration history
    DECISIONS.md            product and engineering rationale
    basic-hatting.md         initial working guide
    playbook.md              this file, the practical working playbook
```

## Default setup

### Run locally

```bash
cd Timeline-Planner
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/TimelinePlanner.html
```

### What to expect

- No backend, database, or build pipeline is required.
- The app runs directly in the browser.
- Data is stored in browser localStorage.
- Immutable.js is loaded from a CDN.

## How to work in this repo

### 1. Start with the roadmap

Before touching code, check `docs/ROADMAP.md`.

Ask:
- Is this near-term, mid-term, or future work?
- Is the idea a small enhancement or a bigger shift?
- Does this feature already fit the current product direction?

If the answer is unclear, refine the scope before building.

### 2. Check architecture intent

Read `docs/ARCHITECTURE.md` before making structural changes.

The repo is designed around a simple local-first model:
- user-facing timeline interface
- date logic and event scheduling
- local persistence and recovery
- future extensional layers like imports, sync, or collaboration

Do not introduce a more complex stack unless the need is explicit and justified.

### 3. Locate the relevant layer

Use this as your default mapping:

- `TimelinePlanner.html` = page structure and modal forms
- `TimelinePlanner.css` = styling, themes, layout, and interaction states
- `TimelinePlanner.js` = state, rendering, events, drag/drop, local storage, import/export

When making a change, keep the concern in the appropriate layer.

### 4. Keep scope narrow

The strongest iteration pattern is:

```text
small idea -> one focused implementation -> quick manual validation -> doc update if needed
```

Avoid broad rewrites. If a feature grows beyond one concern, split it into smaller milestones.

## Standard iteration loop

Use this process whenever you are building or improving something:

1. Define the user problem in one sentence
2. Check the roadmap and architecture
3. Implement only the smallest relevant change
4. Test it manually in the browser
5. Fix edge cases or obvious regressions
6. Update docs if the feature or decision changes the product
7. Commit the work as a focused unit

## Good manual verification checklist

After implementing a feature, manually test:

- create a new event
- edit an event
- delete an event
- switch between month, week, and day views
- drag an event to a different date
- refresh the page and confirm persistence works
- inspect save/dirty-state behavior
- verify import/export still works

If the change affects date logic, spend a little extra time testing edge cases around month transitions, selections, and event ranges.

## Documentation rules

This repo expects docs to stay useful.

Keep these updated when relevant:

- `docs/ROADMAP.md` for planned vs. done work
- `docs/CHANGELOG.md` for shipped changes
- `docs/DECISIONS.md` for meaningful product or engineering decisions
- `docs/basic-hatting.md` for foundational repo guidance

If a feature changes the app direction, document that decision.

## Decision-making defaults

Use these as defaults when you are not sure what to do next:

- Prefer a simpler experience over clever automation
- Prefer local-first reliability over early infrastructure complexity
- Prefer user-facing clarity over hidden system behavior
- Prefer a small, validated feature over a big unproven architecture
- Prefer docs that explain the current state over docs that are stale

## Working principles

1. The app should stay easy to understand.
2. The product should remain lightweight and fast to iterate on.
3. The timeline experience should feel clear, direct, and low-friction.
4. The repo should remain a place where ideas can be tried without a lot of ceremony.

## Habit to keep

Whenever you make a meaningful change, ask:

- What problem does this solve?
- Is this in the right file?
- Does it fit the repo’s current local-first architecture?
- Did I validate it manually?
- Should I update the roadmap or changelog?

## Final rule

Keep the project approachable.

If something feels too large, break it into smaller tasks. If a workflow is confusing, simplify it. If a choice changes the direction of the product, record it. That is the standard path to steady progress in this repo.
