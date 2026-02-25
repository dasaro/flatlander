# Housing + Demography Audit (v0.9.0 patch)

## Scope
This audit summarizes why houses were underused and why long-run demography drifted, then lists the applied deterministic fixes.

## 1) Root causes found

1. House entry was too strict at contact time.
- Symptoms: many entities touched house walls but did not transition indoors.
- Cause: door latch logic effectively depended on very tight contact-to-door proximity.
- Code pointer (before fix): `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts` (`collectDoorContacts`).

2. Shelter/home intent was under-instrumented and difficult to verify.
- Symptoms: occupancy looked near-zero with little observability.
- Cause: limited counters for seekShelter/inside/stuck behavior.
- Code pointers: `/Users/fdasaro/Desktop/Flatlander/src/core/world.ts`, `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`.

3. Reproduction was not sufficiently tied to durable social/household context.
- Symptoms: either sparse or unstable pair dynamics depending on seed and contact patterns.
- Cause: conception had no explicit spouse/home gate in the prior implementation path.
- Code pointer: `/Users/fdasaro/Desktop/Flatlander/src/systems/reproductionSystem.ts`.

4. No explicit anti-stuck house-approach timeout.
- Symptoms: occasional prolonged wall contact while approaching doors.
- Cause: no deterministic abort path for long continuous contact streaks.
- Code pointer: `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts`.

## 2) Fixes applied

1. Door entry now uses robust collision-door latch, with larger practical epsilon.
- Files:
  - `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts`
- Changes:
  - contact-point based door matching retained,
  - widened `DOOR_CONTACT_EPSILON`,
  - explicit door-portal entry remains side-correct (east women / west men; Flatland Part I §2).

2. Added deterministic wall-follow + approach debug data for shelter/home movement.
- Files:
  - `/Users/fdasaro/Desktop/Flatlander/src/systems/socialNavSteeringSystem.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/render/canvasRenderer.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`
  - `/Users/fdasaro/Desktop/Flatlander/index.html`
- Changes:
  - when colliding with target house while seeking door, steering projects toward door tangent,
  - deterministic fallback tangent direction,
  - optional housing debug overlay (door point, aperture, contact point),
  - per-tick counters: door contacts, entries, inside count, shelter/home intents, stuck-near-house.

3. Added stuck-near-house timeout and abort path.
- Files:
  - `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/core/world.ts`
- Changes:
  - tracks continuous contact streak per entity-house pair,
  - aborts seek intent after bounded ticks,
  - exposes `stuckNearHouseCount` metric.

4. Introduced domestic reproduction gate + spouse/home model integration.
- Files:
  - `/Users/fdasaro/Desktop/Flatlander/src/systems/reproductionSystem.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/systems/feelingSystem.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/core/components.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/core/world.ts`
- Changes:
  - conception requires mutual spouse bond,
  - domestic context required (inside/near home; rain loosens positional strictness),
  - postpartum cooldown enforced by world config,
  - handshake completion can establish household bonds,
  - deterministic arranged pairing pass (rarity-biased) when enabled.

5. Added deterministic fancy names without consuming simulation RNG.
- Files:
  - `/Users/fdasaro/Desktop/Flatlander/src/core/names.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/core/factory.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/main.ts`
  - `/Users/fdasaro/Desktop/Flatlander/src/ui/uiController.ts`
  - `/Users/fdasaro/Desktop/Flatlander/index.html`
- Changes:
  - name generation uses pure hash(seed, entityId),
  - inspector and hover now display names,
  - rank retitles are applied on rank transitions.

6. Stability harness now checks housing usage and bounded cyclic behavior.
- File:
  - `/Users/fdasaro/Desktop/Flatlander/src/tools/stabilityHarness.ts`
- Added metrics:
  - occupancy seen in first 10k,
  - avg inside after warmup,
  - max house contact streak,
  - bounded population band,
  - oscillation/diversity/rank-presence metrics.

## 3) Test coverage added/updated

- New tests:
  - `/Users/fdasaro/Desktop/Flatlander/tests/housingWallFollow.test.ts`
  - `/Users/fdasaro/Desktop/Flatlander/tests/reproductionBondGate.test.ts`
  - `/Users/fdasaro/Desktop/Flatlander/tests/names.test.ts`
- Updated tests:
  - `/Users/fdasaro/Desktop/Flatlander/tests/reproduction.test.ts`
  - `/Users/fdasaro/Desktop/Flatlander/tests/reproductionRarityBias.test.ts`

## 4) Canon vs assumption notes

- Canon-anchored:
  - East/west gendered door behavior, pentagonal-house usage under rain pressure (Part I §2).
  - Feeling/handshake as social recognition path (Part I §5).
  - High-rank fertility rarity and accelerated outcomes are represented in scaled form (Part I §12).

- Assumptions/scaling:
  - deterministic arranged pairing pass for robust long-run diversity,
  - numeric thresholds for door aperture/timeout/cooldowns,
  - domestic context approximation (inside home or near-home/rain context),
  - bounded population band targets chosen for this simulation scale.
