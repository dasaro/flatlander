# Implementation Audit: Environment + BDI Shelter

## Scope
This audit covers the requested environment and behavior updates:
- rain scheduling + shelter-seeking BDI calibration,
- spatial fog field in core perception and God-view shading,
- HP dimming and pregnancy visualization consistency.

## 1) BDI shelter behavior
- **Current behavior (before fix):**
  - shelter desire existed but could lose to roam/other intentions unless danger was immediate.
  - references: `/Users/fdasaro/Desktop/Flatlander/src/systems/socialNavMindSystem.ts` (`chooseIntention`, `desireShelter`, `desireHome`).
- **Fix applied:**
  - added stronger rain-time shelter override path (`rainingShelterOverride`), and increased shelter weighting, especially for women.
  - references: `/Users/fdasaro/Desktop/Flatlander/src/systems/socialNavMindSystem.ts` (rain override block, `desireShelter` branch).
- **Expected impact:**
  - rain windows produce a measurable increase in `seekShelter` intentions and indoor occupancy.

## 2) Rain model
- **Current behavior (before fix):**
  - fixed period and duration.
  - reference: `/Users/fdasaro/Desktop/Flatlander/src/systems/rainSystem.ts`.
- **Fix applied:**
  - deterministic interval jitter around stated baselines:
    - `rainBasePeriodTicks`, `rainPeriodJitterFrac`,
    - `rainBaseDurationTicks`, `rainDurationJitterFrac`.
  - sampling uses `world.rng` (simulation randomness), not render-time randomness.
  - references:
    - `/Users/fdasaro/Desktop/Flatlander/src/core/world.ts` (config defaults),
    - `/Users/fdasaro/Desktop/Flatlander/src/systems/rainSystem.ts` (`jitteredTicks`).

## 3) Fog model
- **Current behavior (before fix):**
  - global scalar fog density only.
- **Fix applied:**
  - added deterministic spatial fog field:
    - pure function `fogDensityAt` with hash-noise grid + bilinear smoothing + torrid-zone relief.
  - Vision now queries local fog density from observer position.
  - renderer shades fog map using the same field parameters captured in frame snapshot.
  - references:
    - `/Users/fdasaro/Desktop/Flatlander/src/core/fogField.ts`,
    - `/Users/fdasaro/Desktop/Flatlander/src/systems/visionSystem.ts`,
    - `/Users/fdasaro/Desktop/Flatlander/src/ui/frameSnapshot.ts`,
    - `/Users/fdasaro/Desktop/Flatlander/src/render/canvasRenderer.ts`.

## 4) Render consistency / race-like mismatch prevention
- **Fix applied:**
  - renderer now consumes immutable frame snapshot environment values (`isRaining`, fog config, overlay toggles), captured once per frame.
  - references:
    - `/Users/fdasaro/Desktop/Flatlander/src/ui/frameSnapshot.ts`,
    - `/Users/fdasaro/Desktop/Flatlander/src/main.ts` (`captureFrameSnapshot` call in `frame()`),
    - `/Users/fdasaro/Desktop/Flatlander/src/render/canvasRenderer.ts` (`render(..., frameSnapshot, ...)`).

## 5) HP dimming + pregnancy marker UX
- **Current behavior:**
  - HP dimming is enabled by default in UI settings (`dimByDeterioration: true`) and computed via pure helper.
  - references:
    - `/Users/fdasaro/Desktop/Flatlander/src/main.ts` (default event highlight settings),
    - `/Users/fdasaro/Desktop/Flatlander/src/render/viewModifiers.ts` (`visualAlpha`),
    - `/Users/fdasaro/Desktop/Flatlander/src/render/canvasRenderer.ts` (per-entity alpha).
- **Fix applied:**
  - pregnant women (segments with active pregnancy) get a distinct fill color override.
  - reference: `/Users/fdasaro/Desktop/Flatlander/src/render/canvasRenderer.ts` (pregnancy color branch).

## 6) Verification hooks
- Mid-run deterministic audit script:
  - `/Users/fdasaro/Desktop/Flatlander/src/tools/midRunAudit.ts`
  - npm script: `npm run sim:midrun`.
- Core tests added/updated:
  - `/Users/fdasaro/Desktop/Flatlander/tests/fogField.test.ts`,
  - `/Users/fdasaro/Desktop/Flatlander/tests/jobs.test.ts`,
  - `/Users/fdasaro/Desktop/Flatlander/tests/midrunSmoke.test.ts`,
  - `/Users/fdasaro/Desktop/Flatlander/tests/frameSnapshot.test.ts`.
