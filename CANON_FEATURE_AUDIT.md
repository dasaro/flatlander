# Canon Feature Audit

## Scope
This audit verifies the screenshot-visible Part I mechanics and event tracks against the shipped `1.0.1` preset. It is a runtime + code audit, not a renderer-only review.

Runtime checks used:
- Fast canon tests in `tests/*.test.ts`
- Long headless runner in `/Users/fdasaro/Desktop/Flatlander/src/tools/canonAudit.ts`

## Feature matrix

| Feature / track | Novel prescription | Code pointers | Automated checks | Status |
|---|---|---|---|---|
| Rain (line track) | Part I, Section 2: rain comes from the North at stated intervals. | `/Users/fdasaro/Desktop/Flatlander/src/systems/rainSystem.ts` (`jitteredTicks`, `update`); `/Users/fdasaro/Desktop/Flatlander/src/ui/rainTimelineStore.ts`; `/Users/fdasaro/Desktop/Flatlander/src/render/eventTimelineRenderer.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/rainSystemJitter.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/rainSchedule.test.ts`; runtime correlation in `npm run canon:audit` | PASS |
| Policy (track) | No single canonical “policy phase” track in Abbott; this is a simulation abstraction for inspection/political pressure. | `/Users/fdasaro/Desktop/Flatlander/src/core/policy.ts`; `/Users/fdasaro/Desktop/Flatlander/src/systems/policyRegimeSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/ui/policyTimelineStore.ts`; `/Users/fdasaro/Desktop/Flatlander/src/render/eventTimelineRenderer.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/policyRegimeSystem.test.ts`; runtime presence in `npm run canon:audit` | ASSUMPTION |
| Cry compliance halt | Part I, Section 4 supports peace-cry as a mandatory public warning. The strict compliance/curfew track is an enforcement assumption. | `/Users/fdasaro/Desktop/Flatlander/src/systems/peaceCrySystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/systems/civicOrderSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/core/events.ts` (`reason: 'CryCompliance' | 'RainCurfew'`) | `/Users/fdasaro/Desktop/Flatlander/tests/peaceCry.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/cryCompliance.test.ts`; runtime counts in `npm run canon:audit` | ASSUMPTION |
| Yield to lady | Part I, Sections 2 and 4 support traffic etiquette around women, but the exact eventized yield logic is a canon-coherent extrapolation. | `/Users/fdasaro/Desktop/Flatlander/src/systems/socialNavMindSystem.ts` (`nearestWomanCryCandidate`, `northYieldDirection`); `/Users/fdasaro/Desktop/Flatlander/src/core/stillness.ts`; `/Users/fdasaro/Desktop/Flatlander/src/core/events.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/socialNavEnvironmentAdaptation.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/yieldToLadyCanon.test.ts`; runtime counts in `npm run canon:audit` | ASSUMPTION |
| Unsuccessful handshake | Part I, Section 5: recognition by feeling is dangerous and requires protocol; failed introductions are canon-consistent. | `/Users/fdasaro/Desktop/Flatlander/src/systems/feelingSystem.ts` (`emitHandshakeFailure`, `canLearnFromFeeling`) | `/Users/fdasaro/Desktop/Flatlander/tests/feeling.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/handshakeCanon.test.ts`; runtime counts in `npm run canon:audit` | PASS |
| Handshake | Part I, Section 5: the felt must stand still; recognition is tactile and reciprocal in practice. | `/Users/fdasaro/Desktop/Flatlander/src/systems/introductionIntentSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/systems/feelingSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/systems/stillnessControllerSystem.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/stillnessHandshake.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/handshakeIntegration.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/handshakeCanon.test.ts` | PASS |
| Enter house | Part I, Section 2: pentagonal houses, east door for women, west door for men. | `/Users/fdasaro/Desktop/Flatlander/src/core/housing/houseFactory.ts`; `/Users/fdasaro/Desktop/Flatlander/src/core/housing/shelterPolicy.ts`; `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts` (`collectDoorContacts`, `enterHouse`) | `/Users/fdasaro/Desktop/Flatlander/tests/housingDoors.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/housingDoorsCanon.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/housingDoorEntryFromCollision.test.ts`; runtime counts in `npm run canon:audit` | PASS |
| Exit house | Part I, Section 2 implies door-governed exit via the same canonical portal geometry. | `/Users/fdasaro/Desktop/Flatlander/src/systems/houseSystem.ts` (`exitHouse`, transit/re-entry cooldown) | `/Users/fdasaro/Desktop/Flatlander/tests/houseEvents.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/housingDoorsCanon.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/housingExitClearance.test.ts`; runtime counts in `npm run canon:audit` | PASS |
| Hospitalized (inspection) | Part I, Section 7: slight irregularity may be treated/cured. | `/Users/fdasaro/Desktop/Flatlander/src/systems/inspectionSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/core/irregularity.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/inspectionSystem.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/inspectionPipelineCanon.test.ts`; runtime counts in `npm run canon:audit` | PASS |
| Inspection death | Part I, Section 7: severe mature irregulars may be condemned/destroyed. | `/Users/fdasaro/Desktop/Flatlander/src/systems/inspectionSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/core/irregularity.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/inspectionSystem.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/inspectionPipelineCanon.test.ts`; runtime counts in `npm run canon:audit` | PASS |
| Death | Abbott directly ties acute danger, irregular execution, and social mortality to the world; the exact HP/erosion bookkeeping is a simulation abstraction. | `/Users/fdasaro/Desktop/Flatlander/src/systems/lethalitySystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/systems/erosionSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/systems/cleanupSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/core/events.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/stabLethality.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/deathTypeCounters.test.ts`; runtime counts in `npm run canon:audit` | PASS |
| Birth | Part I, Sections 3, 7, 11–12: hereditary law, isosceles generational progression, and rank-dependent fertility are all in scope. | `/Users/fdasaro/Desktop/Flatlander/src/core/reproduction/offspringPolicy.ts`; `/Users/fdasaro/Desktop/Flatlander/src/systems/reproductionSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/core/isosceles.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/reproduction.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/offspringPolicy.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/reproductionCanon.test.ts` | PASS |
| Regularized | Part I, Section 7: slight deviations can be cured. | `/Users/fdasaro/Desktop/Flatlander/src/systems/regularizationSystem.ts`; `/Users/fdasaro/Desktop/Flatlander/src/core/irregularity.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/regularization.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/inspectionPipelineCanon.test.ts`; runtime counts in `npm run canon:audit` | PASS |
| Population histogram cyclic peaks/troughs | Abbott does not prescribe a histogram; the claim here is that the UI reflects actual demographic cycles, not charting artifacts. | `/Users/fdasaro/Desktop/Flatlander/src/ui/populationHistoryStore.ts`; `/Users/fdasaro/Desktop/Flatlander/src/tools/demographyMetrics.ts`; `/Users/fdasaro/Desktop/Flatlander/src/tools/canonAudit.ts` | `/Users/fdasaro/Desktop/Flatlander/tests/ecologicalBehavior.test.ts`; `/Users/fdasaro/Desktop/Flatlander/tests/demographyCycles.test.ts`; `npm run canon:audit` | ASSUMPTION |

## Verification notes

### Rain
- Modeled as weather state, not event queue events.
- This is deliberate: the timeline rain line is derived from state, while the audit verifies deterministic transitions and rain/shelter correlation.

### Cry compliance halt
- This track was ambiguous before this patch.
- It now carries a deterministic reason payload:
  - `CryCompliance`
  - `RainCurfew`
- That makes the screenshot-visible track auditable.

### Handshake
- The felt must be in `full` stillness and the feeler in a controlled stillness mode before recognition succeeds.
- Failed handshakes are explicitly recorded and do not update knowledge.

### Houses
- Door law is auditable because `houseEnter` and `houseExit` payloads include `doorSide`.
- Exit bounce protection is verified separately in `/Users/fdasaro/Desktop/Flatlander/tests/housingExitClearance.test.ts`.

### Policy
- The track is stateful and not reducible to event counts alone.
- `policyShift` verifies transitions; the visible line is the UI-side active phase.

### Population cycles
- The renderer is not treated as evidence.
- The headless audit reads sampled entity counts directly from the simulation and computes amplitude/extrema on the sampled series.

## Runtime audit summary
- `npm run canon:audit` passed on preset `v1-canonical-2026-03-08` for seeds `42`, `7`, `13`, and `101` over `60k` ticks per seed.
- Shelter activity was consistently higher during rain than dry periods:
  - `rainRatio`: `6.02`, `6.41`, `6.32`, `7.12`
  - `enterRateRain > enterRateDry` for all four seeds
- Houses were actively used in all runs:
  - `houseEnter`: `1089`, `1237`, `1184`, `1096`
  - `houseExit`: `1073`, `1185`, `1167`, `1082`
  - `housesUsed`: `8`, `8`, `8`, `8`
- Policy phases were observed at runtime in all runs despite being an explicit simulation assumption:
  - `policyShift` counts: `32`, `20`, `28`, `12`
- Handshake outcomes were non-vacuous and auditable:
  - successful handshakes: `1771`, `1874`, `1918`, `1766`
  - failed handshakes: `10`, `6`, `16`, `3`
  - dominant failure reason: `StillnessNotSatisfied`
- Inspection/regularization pipeline was exercised:
  - `hospitalized`: `32`, `44`, `31`, `17`
  - `inspectionDeath`: `16`, `13`, `16`, `5`
  - `regularized`: `450`, `530`, `456`, `425`
- Population cyclicity was verified headlessly rather than inferred from the chart:
  - amplitudes: `0.802`, `0.373`, `0.530`, `0.548`
  - alternating extrema counts: `30`, `28`, `32`, `28`
- Audit acceptance summary:
  - `shelter=4/4`
  - `cycles=4/4`
  - `houseUsage=4/4`
  - artifact: `/Users/fdasaro/Desktop/Flatlander/.artifacts/canon_audit.json`
