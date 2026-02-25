# Housing / Demography / Mobile UX Audit

## Scope
- House exit collision trap
- Long-run demography cyclic behavior checks
- Mobile menu behavior

## Status
- Implemented in this patch:
  - deterministic exit transit + pair-specific house collision ignore + transit steering override,
  - multi-seed demography cycle tests (including seed 42) using shared default scenario,
  - mobile off-canvas drawer with backdrop + Escape close.

## 1) House exit collision trap
### Current behavior
- Entities exit via `exitHouse(...)` and are placed just outside the chosen doorway.
- They can immediately re-contact the same house wall and get repeatedly corrected by collision resolution, creating jitter/trapping loops.

### Evidence / code pointers
- Exit placement: `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts` `exitHouse`.
- No pair-specific temporary collision suppression for post-exit: `/Users/fdasaro/Desktop/Flatlander/src/systems/collisionSystem.ts` `rebuildCollisionState` currently considers all outside entities.
- Steering can still aim into/along walls without explicit transit mode: `/Users/fdasaro/Desktop/Flatlander/src/systems/socialNavSteeringSystem.ts`.
- Contact-streak abort exists but only for approach intent, not robust post-exit transit: `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts` (`STUCK_ABORT_TICKS`).

### Suspected root cause
- Missing deterministic door-transit state after exit (clearance + temporary ignore only for exiting house pair).
- Exit offset alone is insufficient when collision correction and steering react in the same area.

### Planned fix
- Extend dwelling state with explicit transit metadata and per-house temporary ignore window.
- Apply strong deterministic push-out for a short exit phase.
- Add collision predicate to suppress only `(entity, transit-house)` pairs during ignore ticks.
- Ensure transit ticks are decremented in one place and steering honors transit direction.

## 2) Long-run demography cyclic behavior
### Current behavior
- Existing harness validates boundedness/diversity but not explicit alternating cycles across a fixed multi-seed set including 42.
- Cycle-shape assertions (peak/trough alternation) are missing from automated tests.

### Evidence / code pointers
- Stability harness metrics: `/Users/fdasaro/Desktop/Flatlander/src/tools/stabilityHarness.ts`.
- Scenario defaults are duplicated between app and harness (`defaultPlan` in harness and `defaultSpawnPlan` in main):
  - `/Users/fdasaro/Desktop/Flatlander/src/tools/stabilityHarness.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts` (`defaultSpawnPlan`).

### Suspected root cause
- No test-level acceptance for alternating extrema on long windows.
- Shared default scenario module absent, so test/harness/app can drift.

### Planned fix
- Add deterministic seed list and long-run cycle tests.
- Add pure demography metrics helper for smoothing + extrema counting.
- Extract default scenario/spawn plan to a shared preset module used by app and tests.
- Tune only existing canon-coherent levers if cycle assertions fail.

## 3) Mobile menu UX
### Current behavior
- Mobile uses `sidebar-collapsed` class toggling only; no drawer/backdrop semantics.
- Desktop and mobile share same collapse logic; no off-canvas behavior.

### Evidence / code pointers
- Toggle wiring: `/Users/fdasaro/Desktop/Flatlander/src/main.ts` `initializeResponsiveUi`.
- Layout classes: `/Users/fdasaro/Desktop/Flatlander/src/styles.css` `.app-shell.sidebar-collapsed`, media blocks.
- Toggle button markup: `/Users/fdasaro/Desktop/Flatlander/index.html` `#sidebar-toggle-btn`.

### Suspected root cause
- Old collapse implementation predates drawer pattern.
- No backdrop, no Escape-close binding, no body scroll lock.

### Planned fix
- Implement a dedicated mobile drawer state helper.
- Add backdrop and `body.menu-open` class transitions.
- Add accessible `aria-expanded` / `aria-controls`, Escape + backdrop close.
- Add jsdom test for menu open/close behavior.
