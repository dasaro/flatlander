# Stability Contract

When a change touches reproduction, mortality, movement, lethality, or erosion:

1. Run `npm run stability` (quick deterministic regression run).
2. For release-level demographic checks, run `npm run stability -- --full`.
3. The harness must pass its configured thresholds (oscillation + diversity + rank persistence).

## Metrics enforced by harness
- Oscillation amplitude of total population.
- Shannon diversity index over rank composition.
- Persistent rank presence in trailing window.
- NearCircle/Priest reappearance check on long horizon (`--full`).

## Determinism requirements
- Stable iteration order.
- Seeded RNG only.
- No ad-hoc nondeterministic randomness.
