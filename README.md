# GoodOmens

A timeline planner for organizing future commitments, milestones, and agenda items with minimal friction.

## Overview
GoodOmens is a lightweight planning tool for organizing future commitments, milestones, and agenda items with minimal friction. The project is currently in its foundation and planning phase.

## Documentation
- [Roadmap](docs/ROADMAP.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Changelog](docs/CHANGELOG.md)
- [Decision Log](docs/DECISIONS.md)

## Run offline
The planner's Immutable.js and SQL.js runtimes, including the SQLite WebAssembly binary, are stored in `assets/vendor/`. After cloning or downloading the repository, no CDN or internet connection is needed to run the app.

From the repository folder, start a local server with:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000/TimelinePlanner.html`. The local server is needed so browsers can load the SQLite WebAssembly file; it does not require an internet connection.

## Product Vision
Create a simple, reliable timeline planning experience that helps users organize future commitments, milestones, and agenda items without friction.

## Goals
- Make planning fast and intuitive
- Support both short-term and long-range scheduling
- Keep state reliable and easy to recover
- Support sharing and collaboration over time

## Current Focus
- Define the MVP timeline experience
- Establish core planning workflows
- Document roadmap, architecture, and decisions
- Prepare for implementation and milestone tracking

## Status
This repository has been initialized with an early product roadmap and supporting docs so work can begin in a structured way.
