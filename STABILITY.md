# Stability Contract

When a change touches reproduction, mortality, movement, lethality, or erosion:

1. Run `npm run stability` (quick deterministic regression run).
2. For release-level demographic checks, run `npm run stability -- --full`.
3. Run `npm run sim:midrun` for the shared-stack short-horizon ecology/rain-housing smoke audit.
4. Run `npm run sim:v1` when evaluating readiness against the frozen `1.0` release contract.
5. The harness must pass its configured thresholds (oscillation + diversity + rank persistence).

## Canonical release preset

- Preset id: `v1-canonical-2026-03-08`
- Source: `/Users/fdasaro/Desktop/Flatlander/src/presets/releasePreset.ts`
- The app, `sim:midrun`, `sim:v1`, and `stability -- --full` must all evaluate this same preset.

## Metrics enforced by harness
- Oscillation amplitude of total population.
- Shannon diversity index over rank composition.
- Persistent rank presence in trailing window.
- NearCircle/Priest reappearance check on long horizon (`--full`).
- House occupation within the first 10k ticks on the long horizon.
- Shelter deadlock checks (`maxHouseContactStreak`, `stillTooLongCount`).

## Long-horizon release thresholds

For `npm run stability -- --full`, the frozen release gate currently requires:

- amplitude `>= 0.12`
- at least `2` peaks and `2` troughs
- at least `4` alternating turning points
- average Shannon diversity `>= 0.95`
- at least `5` represented rank buckets in the trailing window
- bounded population in `[20, 650]`
- zero sustained house-contact lockups
- zero “still too long while seeking” failures

The diversity floor is calibrated to the shipped eight-bucket release slice rather than an uncapped theoretical caste distribution.

## Determinism requirements
- Stable iteration order.
- Seeded RNG only.
- No ad-hoc nondeterministic randomness.
