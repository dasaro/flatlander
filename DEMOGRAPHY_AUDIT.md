# Demography Audit (Canon Hooks)

## Scope
This audit covers deterministic long-run population dynamics after introducing canon-inspired hooks for rain cycles, high-order fertility/development, neo-therapy, crowd stress, and rarity-biased partner choice.

## 1) Previous trend (before this patch)
Observed trend from prior harness runs:
- early decline, then plateau, then growth skewed toward repeated female births,
- weak recurrence of rare ranks,
- limited oscillatory behavior in total population.

## 2) New metrics and acceptance checks
Implemented in `/Users/fdasaro/Desktop/Flatlander/src/tools/stabilityHarness.ts`:
- time-series sampling every 200 ticks,
- oscillation amplitude over trailing window,
- Shannon diversity index over rank composition,
- persistent rank-presence count,
- NearCircle/Priest reappearance check on long horizon,
- JSON artifact output to `.artifacts/demography/`.

Threshold policy:
- quick/default run (`npm run stability`): practical thresholds for fast regression checks,
- canonical long run (`npm run stability -- --full`): stricter thresholds and 120k-tick rare-rank check.

## 3) Canon hooks implemented
1. Rain periodic forcing (Part I §2)
- Files: `/Users/fdasaro/Desktop/Flatlander/src/systems/rainSystem.ts`, `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts`, `/Users/fdasaro/Desktop/Flatlander/src/core/housing/shelterPolicy.ts`.
- Effect: deterministic rain on/off cycles drive sheltering and periodic crowding.

2. High-rank fertility decreases; rare high-rank sons can overleap (Part I §11)
- File: `/Users/fdasaro/Desktop/Flatlander/src/core/reproduction/offspringPolicy.ts`.
- Effect: stronger high-order fertility penalties plus bounded deterministic side jumps for high-order fathers.

3. Neo-therapeutic gymnasium analog (Part I §11, scaled assumption)
- File: `/Users/fdasaro/Desktop/Flatlander/src/systems/neoTherapySystem.ts`.
- Effect: near-circular newborn males can be enrolled; isolated during therapy; low survival; courtesy promotion on success.

4. Crowd-caused irregularity/mortality feedback (Part I §7/§11)
- File: `/Users/fdasaro/Desktop/Flatlander/src/systems/crowdStressSystem.ts`.
- Effect: dense local neighborhoods increase wear, irregularization risk, and attritional death pressure.

5. Mild arranged-marriage analog for rarity persistence (Part I §3 generalized)
- File: `/Users/fdasaro/Desktop/Flatlander/src/systems/reproductionSystem.ts`.
- Effect: deterministic, clamped rarity-weighted father selection to reduce permanent rank extinction.

## 4) Determinism and architecture checks
- Core/systems remain headless (no DOM/canvas code added under `/src/core` or `/src/systems`).
- Stable ordering preserved (sorted iteration, deterministic tie-breaks).
- RNG usage confined to seeded `world.rng` and consumed in stable loops.
- No render-time randomness.

## 5) Validation summary
Commands run:
- `npm test`
- `npm run lint`
- `npm run build`
- `npm run stability`

Latest `npm run stability` (quick run) summary:
- 4 seeds x 8000 ticks
- amplitude avg: 1.530
- Shannon avg: 1.289
- ranks present avg: 7.00
- checks: PASS
- artifact written under `.artifacts/demography/`

## 6) New tests
- `/Users/fdasaro/Desktop/Flatlander/tests/offspringPolicy.test.ts`
  - high-order fertility penalties monotone,
  - deterministic high-order side jumps.
- `/Users/fdasaro/Desktop/Flatlander/tests/reproductionRarityBias.test.ts`
  - rarity boost clamping/ordering,
  - deterministic rare-rank father selection.
- `/Users/fdasaro/Desktop/Flatlander/tests/neoTherapySystem.test.ts`
  - deterministic therapy outcomes,
  - therapy enrollment exclusion from movement/collision.
- `/Users/fdasaro/Desktop/Flatlander/tests/crowdStressSystem.test.ts`
  - stress monotonicity,
  - no stress effect while indoors.

## 7) Assumptions explicitly retained
- Numeric thresholds (side caps, jump caps, stress constants) are simulation scaling assumptions.
- Neo-therapy implementation is a compact analog, not a full institutional pipeline.
- Rarity-bias partner selection is a mild generalized proxy for priest-arranged intermarriage.
