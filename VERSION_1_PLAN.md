# Flatlander Version 1 Plan

## Purpose

This document defines what `1.0.0` means for this repository and records the release contract that was used to justify that bump.

The bar for `1.0.0` is not “every Flatland idea is implemented.” It is:

- the chosen simulation slice is internally coherent,
- core novel laws are implemented or explicitly scoped out,
- ecology is stable across fixed seeds,
- renderer/UI truthfully expose simulation state,
- release verification is deterministic and repeatable.

## Current audit

### What is already strong

- Headless core/system layering is mostly clean.
- Deterministic fixed-step simulation is established and broadly tested.
- Canonical heredity laws are present:
  - regular polygon fathers produce `+1` side sons,
  - isosceles fathers improve by `+0.5°` brain-angle per generation to regularity.
- Rain, houses, doors, fog, hearing, stillness, feeling, lineage, and inspection all exist.
- The project already has multi-seed ecology tooling (`stability`, `sim:midrun`, housing audits).
- The canonical release preset is now frozen as `v1-canonical-2026-03-08` in `/Users/fdasaro/Desktop/Flatlander/src/presets/releasePreset.ts`.
- The app, the audit tools, and the release-oriented tests now use the same shared default stack and preset path.

### Release-gate status for `1.0.0`

The `1.0.0` candidate was accepted only after all of the following were green on the frozen preset:

- `npm test`
- `npm run lint`
- `npm run build`
- `npm run stability -- --full`
- `npm run sim:midrun`
- `npm run sim:v1`

### Final release preset contract

- Release preset id: `v1-canonical-2026-03-08`
- Source of truth: `/Users/fdasaro/Desktop/Flatlander/src/presets/releasePreset.ts`
- Consumed by:
  - `/Users/fdasaro/Desktop/Flatlander/src/presets/defaultScenario.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/tools/stabilityHarness.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/tools/midRunAudit.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/tools/versionOneAudit.ts`

### Final ecology gate outcome

On the frozen preset, the long-horizon gate passed with:

- 8/8 seeds bounded within the full-horizon population band,
- 8/8 seeds showing house occupation within the first 10k ticks,
- 8/8 seeds showing rare-rank presence,
- average oscillation amplitude `0.884`,
- average Shannon diversity `0.970`,
- zero sustained shelter-contact lockups,
- zero “still too long while seeking” failures.

## Definition of done for `1.0.0`

### Gate A: Ecology

Using the shared default world + shared default system stack:

- no routine extinction across fixed seeds,
- no monotonic runaway population growth,
- recurring peaks and troughs in long runs,
- houses actively used during rain,
- rare classes (NearCircle/Priest) can reappear without out-of-band spawning,
- no persistent “stuck trying to shelter” behavior.

### Gate B: Canon closure

The following must be true and documented in `NOVEL_AUDIT.md`:

- regular male heredity `+1` side,
- isosceles `+0.5°/generation` to regularity,
- fog gives comparative dimness rather than blindness,
- feeling requires stillness,
- peace-cry / yielding are enforced coherently,
- rain + house orientation + sexed doors are operational,
- rank/job mappings are canon-compatible,
- priests remain rare but possible.

### Gate C: UX truthfulness

- HP, age, pregnancy, stillness, indoors, weather, and fog cues must reflect real simulation state.
- No major dead controls.
- Inspector/narrative/timeline must describe the active model rather than an approximation.

### Gate D: Verification

`1.0.0` requires all of the following on the release candidate:

- `npm test`
- `npm run lint`
- `npm run build`
- `npm run stability -- --full`
- `npm run sim:midrun`
- `npm run sim:v1`

## Implementation roadmap

### Phase 1: Unify the shipped simulation stack

Status: complete.

Create a shared default system-stack factory and use it in:

- the browser app,
- ecology/release audit tools,
- long-running integration tests that are supposed to represent shipped behavior.

Reason:
- this is the highest-ROI enabling step,
- it removes “tooling drift” before further balancing work.

### Phase 2: UX audit and control truthfulness

Status: complete for the `1.0.0` cut.

Audit the GUI and wire control availability to real model applicability:

- disable structurally impossible controls,
- label reset-scoped controls clearly,
- ensure selection-only overlays/actions are visibly unavailable without a selection,
- remove or explain any dead control before `1.0.0`.

Reason:
- a `1.0.0` build cannot ship a misleading control surface.

### Phase 3: Freeze a release preset

Status: complete.

Define one explicit default/canonical release scenario:

- same spawn plan,
- same topology,
- same weather/housing defaults,
- same social/policy defaults.

Reason:
- tuning without a frozen target produces moving baselines.

### Phase 4: Strengthen ecology acceptance

Status: complete for the frozen `1.0.0` preset.

Tune only with canon-compatible mechanisms already in scope:

- shelter seeking,
- domestic reproduction gating,
- rain/crowd stress feedback,
- neo-therapy rarity,
- priest recurrence,
- house usage.

Reason:
- this was the main substantive blocker before the `1.0.0` cut and remains the first gate to revisit for any future major release.

### Phase 5: Observability and truthfulness sweep

Status: complete for the shipped slice.

Make it easy to verify the model without reading source:

- inspector surfaces inherited brain angle, house/home state, stillness state, fertility state,
- renderer preserves HP/pregnancy/weather cues under combined overlays,
- narrative/timeline stay high-signal.

## Post-1.0 next step

Keep future feature work pinned to the frozen release contract:

- if defaults change, update `/Users/fdasaro/Desktop/Flatlander/src/presets/releasePreset.ts`,
- if ecology changes, re-run the full gate before any further major version bump,
- if the shipped slice expands materially, create a new explicit preset instead of silently mutating the `1.0` one.
