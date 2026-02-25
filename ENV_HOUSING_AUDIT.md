# Environment + Housing Audit

Date: 2026-02-25  
Scope: rain/fog visibility, occupancy defaults, house transition events, long-run house usage instrumentation.

## 1) Rain visibility in God-view
- Current behavior:
  - Rain state is computed headlessly in `src/systems/rainSystem.ts` (`RainSystem.update`).
  - UI stats already expose rain state (`stat-rain-active`) via `src/ui/uiController.ts` (`renderStats`).
  - God-view renderer has no dedicated rain overlay; users only infer rain from behavior/stats.
- Expected:
  - Rain should be clearly visible in God-view with deterministic visuals.
- Code pointers:
  - Simulation: `src/systems/rainSystem.ts`
  - Render loop: `src/main.ts` (`frame`)
  - Canvas renderer: `src/render/canvasRenderer.ts` (`render`, `drawSouthIndicator`)
- Planned fix:
  - Add immutable per-frame environment snapshot captured once per rAF.
  - Add deterministic screen-space rain overlay driven by `tick` (no RNG / no `performance.now`).

## 2) Fog visibility in God-view
- Current behavior:
  - Fog affects perception in `src/systems/visionSystem.ts`.
  - God-view fog is currently represented mostly through selected-entity fog preview (`fogPreviewEnabled`) in `src/render/canvasRenderer.ts`.
  - No global fog haze exists, so fog can be hard to perceive when no selection is active.
- Expected:
  - Fog should be visibly present in God-view even without selection.
- Code pointers:
  - Perception logic: `src/systems/visionSystem.ts`
  - Renderer fog preview: `src/render/canvasRenderer.ts` (`drawFogFieldPreview`, `drawFogPreviewRings`)
- Planned fix:
  - Snapshot-based global fog overlay with controlled alpha.
  - Display fog density near HUD so users can verify state.

## 3) Renderer state consistency for environment overlays
- Current behavior:
  - Renderer reads world state directly during render (`world.config`, `world.weather` in various paths).
  - UI toggles can mutate settings while rendering in the same frame path.
- Expected:
  - Renderer should consume a consistent, immutable environment snapshot per frame for rain/fog bits.
- Code pointers:
  - `src/main.ts` (`frame`)
  - `src/render/canvasRenderer.ts` (`render`)
- Planned fix:
  - Add `src/ui/frameSnapshot.ts` (`captureFrameSnapshot`) and route environment-dependent rendering through it.

## 4) House occupancy counters default visibility
- Current behavior:
  - Occupancy rendering exists in renderer (`drawHouse(... showOccupancy ...)`), but UI defaults are off:
    - `src/main.ts`: `environmentSettings.showOccupancy = false`
    - `index.html`: `#env-show-house-occupancy` unchecked.
- Expected:
  - House occupancy counters visible by default.
- Code pointers:
  - `src/main.ts`
  - `index.html`
  - `src/ui/uiController.ts` (`readEnvironmentSettings`)
- Planned fix:
  - Flip default to ON in UI and runtime initialization.

## 5) House enter/exit as first-class events
- Current behavior:
  - House transitions happen in `src/systems/houseSystem.ts` (`enterHouse`, `exitHouse`), but no domain events are emitted there.
  - Timeline/legend cannot show enter/exit because event model lacks those types.
- Expected:
  - `houseEnter` and `houseExit` should be typed events, visible in timeline and legend, with hover counts.
- Code pointers:
  - Transition logic: `src/systems/houseSystem.ts`
  - Event model: `src/core/events.ts`
  - Timeline analytics: `src/ui/eventAnalytics.ts`
  - Timeline rendering: `src/render/eventTimelineRenderer.ts`
  - Legend model: `src/ui/legendModel.ts`
- Planned fix:
  - Extend `WorldEvent` with enter/exit payload including reason and door side.
  - Emit events at transition points.
  - Integrate with analytics/timeline controls/legend/effects.

## 6) Long-run house usage coverage
- Current behavior:
  - Existing regression `tests/housingLongRunRegression.test.ts` verifies sustained entry/occupancy over 4.8k ticks.
  - No dedicated long-run (multi-seed, 120k) enter/exit reason report artifact.
- Expected:
  - Multi-seed long runs (including seed 42) with explicit enter/exit totals and reason distributions.
- Code pointers:
  - Existing test: `tests/housingLongRunRegression.test.ts`
  - Existing broader harness: `src/tools/stabilityHarness.ts`
- Planned fix:
  - Add `src/tools/housingLongRun.ts` + npm script `housing:longrun`.
  - Save report to `.artifacts/housing_runs.json` and print summary.

## Fixed in this patch
- Added immutable frame snapshot capture (`src/ui/frameSnapshot.ts`) and wired render loop to pass one snapshot per frame (`src/main.ts`, `frame`).
- Added deterministic God-view rain/fog overlays in renderer:
  - screen-space rain streaks driven by `snapshot.tick`,
  - global fog haze driven by snapshot fog density,
  - HUD indicators (`RAIN`, `Fog x.xxx`).
  - Code: `src/render/canvasRenderer.ts` (`drawEnvironmentOverlay`, `drawRainOverlay`, `drawSouthIndicator`).
- Added environment toggles:
  - `Show Rain Overlay`, `Show Fog Overlay`.
  - Code: `index.html`, `src/ui/uiController.ts`, `src/main.ts`.
- Made house occupancy counters visible by default:
  - `showOccupancy: true` in runtime defaults and checkbox default checked.
  - Code: `src/main.ts`, `index.html`.
- Added first-class house transition events:
  - new event types `houseEnter`, `houseExit`,
  - deterministic reason payloads (`RainShelter`, `Wander`, etc.),
  - emitted at exact state transitions in `HouseSystem`.
  - Code: `src/core/events.ts`, `src/systems/houseSystem.ts`.
- Timeline/legend/effects integration:
  - new timeline rows and controls for enter/exit,
  - legend icons and visual effects for enter/exit.
  - Code: `src/ui/eventAnalytics.ts`, `src/render/eventTimelineRenderer.ts`, `src/ui/legendModel.ts`, `src/render/effects.ts`, `index.html`, `src/main.ts`.
- Added regression and smoke tests:
  - `tests/frameSnapshot.test.ts`
  - `tests/houseEvents.test.ts`
  - `tests/housingUsageSmoke.test.ts`
  - plus updates to `tests/eventAnalytics.test.ts`, `tests/eventsEffects.test.ts`.
- Added long-run housing harness:
  - `src/tools/housingLongRun.ts`
  - npm script `housing:longrun`
  - artifact output `.artifacts/housing_runs.json`.

## Long-run verification snapshot (latest local run)
- command: `npm run housing:longrun`
- seeds: 42, 7, 13; ticks per seed: 120,000
- results:
  - seed 42: enters 3193, exits 3190, houses used 8, avg inside 3.19
  - seed 7: enters 3514, exits 3513, houses used 8, avg inside 3.51
  - seed 13: enters 3161, exits 3161, houses used 8, avg inside 3.16
- dominant reasons observed:
  - entries: `RainShelter`, `Wander`
  - exits: `WaitForBearing`, `Wander`
- acceptance checks: PASS for all seeds.
