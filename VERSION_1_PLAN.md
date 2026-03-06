# Flatlander Version 1 Plan

## Purpose

This document defines what `1.0.0` means for this repository and what remains to be done before that bump is justified.

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

### Main blockers to `1.0.0`

1. Ecology acceptance is not yet robust enough.
   - Long runs still do not consistently satisfy the project’s strongest boom/bust and compliance gates.
   - Current evidence is split across multiple scripts with different horizons and different purposes.

2. The release/audit stack is not fully unified with the app stack.
   - `src/main.ts` runs `CivicOrderSystem` in the default browser simulation.
   - `src/tools/midRunAudit.ts` and `src/tools/stabilityHarness.ts` previously constructed their own near-duplicate system stacks without that same source of truth.
   - This makes “passes in harness” vs “ships in app” less defensible than it should be.

3. Default canonical preset is not yet frozen as an explicit release target.
   - We have a default scenario and multiple tuning knobs.
   - We do not yet have a sharply defined “this is the `1.0` canonical release preset” contract.

4. Some canon-correct mechanics are difficult to observe in normal runs.
   - Example: isosceles ascent is generational and therefore extremely slow.
   - This is not wrong, but it needs good observability so users can verify it.

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

Create a shared default system-stack factory and use it in:

- the browser app,
- ecology/release audit tools,
- long-running integration tests that are supposed to represent shipped behavior.

Reason:
- this is the highest-ROI enabling step,
- it removes “tooling drift” before further balancing work.

### Phase 2: Freeze a release preset

Define one explicit default/canonical release scenario:

- same spawn plan,
- same topology,
- same weather/housing defaults,
- same social/policy defaults.

Reason:
- tuning without a frozen target produces moving baselines.

### Phase 3: Strengthen ecology acceptance

Tune only with canon-compatible mechanisms already in scope:

- shelter seeking,
- domestic reproduction gating,
- rain/crowd stress feedback,
- neo-therapy rarity,
- priest recurrence,
- house usage.

Reason:
- this is the main remaining blocker to `1.0.0`.

### Phase 4: Observability and truthfulness sweep

Make it easy to verify the model without reading source:

- inspector surfaces inherited brain angle, house/home state, stillness state, fertility state,
- renderer preserves HP/pregnancy/weather cues under combined overlays,
- narrative/timeline stay high-signal.

## Immediate next step

Standardize the default headless system stack and make the `1.0` audit depend on that single source of truth.
