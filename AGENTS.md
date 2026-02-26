# Flatlander Engineering Contract

This repository enforces the following rules for all implementation work.

## 1) Layer boundaries
- `src/core/**` and `src/systems/**` are headless simulation code only.
- DOM/canvas/browser APIs are restricted to renderer/UI adapters (`src/render/**`, `src/ui/**`, `src/main.ts`).
- Do not add cross-layer coupling from core/systems into UI/render.

## 2) Determinism contract
- Simulation randomness must come only from `world.rng` and be consumed in stable iteration order.
- Cosmetic rendering randomness must never consume `world.rng`; use deterministic hash functions instead.
- New systems must iterate entities/pairs in deterministic sorted order when order matters.
- Fixed-step behavior must remain deterministic for identical seed + user actions.

## 3) Frame snapshot rule (environment rendering)
- Renderer environment overlays must use a per-frame immutable snapshot (`captureFrameSnapshot`) captured once after sim update.
- Renderer must not read mutable weather/config fields directly for environment overlays during draw.
- UI toggles affecting overlays are applied through snapshot capture boundaries, not mid-draw mutation.

## 4) Field/policy purity requirements
- Any new global field (e.g., fog field) must be implemented as a pure deterministic function.
- Field helpers must be unit tested for determinism and bounds.
- Simulation policies should be pure/helper-driven where practical to keep behavior testable.

## 5) Required verification before release
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run sim:midrun` (multi-seed ecology audit: cycles + shelter usage + rare priest emergence)

## 6) Documentation maintenance
- Update `NOVEL_AUDIT.md` when mechanics change, explicitly marking canon vs assumption.
- Keep release notes in `CHANGELOG.md` aligned with shipped behavior.
