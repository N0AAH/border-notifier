# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**єЧерга** — a browser-based vehicle queue monitor for Ukrainian border checkpoints. Users enter a license plate; the app polls the official `back.echerha.gov.ua` API (through a Cloudflare Worker CORS proxy) and sends browser notifications with position and ETA updates.

## Running the App

No build step, no package manager, no dependencies to install.

- Open `index.html` directly in a browser, or serve it with any static file server (e.g., `python -m http.server`).
- There are no tests.

## Architecture

**Pure static site** — HTML + CSS + vanilla JS. jQuery 3.7.1 and jQuery UI 1.14.2 are loaded from CDN solely for drag-and-drop tab reordering.

### State Model

All application state lives in `assets/js/app.js`. The top-level shape:

```
watchers[]             — array of watcher objects, one per tab
activeWatcherId        — currently visible tab
localStorage           — STORAGE_KEY='ech_watchers_v1', ACTIVE_TAB_KEY='ech_active_watcher_id'
```

Each watcher holds: `id`, `plate` (normalized), `interval` (poll seconds: 60/180/300), `pingEvery` (notify every N polls: 3/5/10), `checkpointId/Name`, `isRunning`, `loopHandle` (setTimeout id), `lastKey` (change-detection hash), `pingCounter`, `tabLabel`, `fields` (display data), `status/statusClass`.

### Key Functions in `assets/js/app.js`

| Function | Purpose |
|---|---|
| `DOMContentLoaded` listener | Bootstraps app; restores watchers from localStorage; re-starts running ones with 2 s staggered offsets |
| `startWatcher(id)` | Validates plate, requests notification permission, kicks off polling loop |
| `loopWatcher(id)` | Schedules recursive `setTimeout` at the watcher's interval |
| `tickWatcher(id)` | One poll cycle: calls API, updates fields, fires notification if needed |
| `findVehicle(plate)` | Iterates `CHECKPOINTS` array, calling `fetchCheckpoint` for each until the plate is found |
| `fetchCheckpoint(id, plate)` | Hits the Cloudflare proxy with retry logic (HTTP 429/403 → exponential back-off, max 3 retries) |
| `saveWatchers()` | Serializes `watchers[]` to localStorage (strips `loopHandle` before serializing) |
| `renderTabs()` / `renderForm()` | Full re-render of tab strip and form area from current state |

### API Flow

```
Browser → Cloudflare Worker (gentle-fire-c156.epiktet501.workers.dev)
        → back.echerha.gov.ua/api/v4/workload/1/checkpoints/{id}/details/1/30
```

Plate normalization converts Cyrillic lookalike characters to Latin and strips non-alphanumeric chars before searching.

### Change Detection

`lastKey` = `JSON.stringify([position_number, confirmed_at])`. A notification fires when `lastKey` changes **or** when `pingCounter` reaches the `pingEvery` threshold (periodic reminder).

### Checkpoints

`CHECKPOINTS` is a hardcoded array of 21 Ukrainian border crossings (IDs 1–31, 80, 84, 87–91, 97–98) covering Poland, Moldova, and Slovakia borders for various truck/cargo categories.
