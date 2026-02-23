# NOVEL_FAITHFULNESS AUDIT (Flatlander v0.7.5)

## 0. Repo snapshot
- Commit: `71576155663a816b54ac5d3e4276db9859a4a05b`
- App version: `0.7.5` (`package.json`)
- Runtime: browser-only Vite/TS app (`src/main.ts`, `src/core/world.ts`)
- Run commands:
  - `npm run dev`
  - `npm test`
  - `npm run build`
  - `npm run stability`

## 0.1 Canon Compliance Checklist (must-fix direct laws)
| Canon law | Novel anchor | Status | Code pointers | Tests |
|---|---|---|---|---|
| **A) Law of Nature**: regular male polygon child has one more side than father | Part I, Section 3 (*Concerning the Inhabitants of Flatland*) | **Implemented** (canon rule primary; side cap is scaling assumption) | `src/core/reproduction/offspringPolicy.ts` `determineMaleChildShapeFromParents`; `src/systems/reproductionSystem.ts` `update` | `tests/reproduction.test.ts`; `tests/offspringPolicy.test.ts` |
| **B) Fog semantics**: no fog means visibility remains, but comparative dimness cue is absent | Part I, Section 6 (*Of Recognition by Sight*) | **Implemented** | `src/systems/visionSystem.ts` `update`; `src/systems/avoidanceSteeringSystem.ts` sight/hearing weighting; `src/render/flatlanderScan.ts` intensity model | `tests/visionFog.test.ts`; `tests/flatlanderScan.test.ts`; `tests/hearingSystem.test.ts` |
| **C) Isosceles heredity**: brain-angle progression by generation (+0.5°, cap at 60°, then regular triangle) | Part I, Section 3 (isosceles heredity narrative) | **Implemented** (primary canon mechanism) | `src/core/isosceles.ts`; `src/core/reproduction/offspringPolicy.ts`; `src/core/factory.ts`; `src/core/world.ts` (`brainAngles`) | `tests/offspringPolicy.test.ts` |

## 1. Executive summary
### Implemented narrative mechanics (current as-is)
- Women as line segments; men as polygons; priests as circles.
- Rank/caste mapping (triangle subclasses, gentlemen, nobles, near-circles, priests, irregular/criminal).
- Southward attraction law with zonal strength, damping, and escape clamp.
- Fog-gated sight and a separate Flatlander 1D strip view.
- Perimeter eye points per entity with directional, limited-FOV glance.
- Hearing, peace-cry emissions, and isosceles voice imposture.
- Touch/feeling-based recognition and handshake events.
- Handshake stillness window (short stand-still lock after successful recognition).
- Vertex/endpoint lethality with sharpness, impact, pressure accumulation, and kill attribution.
- Wear/erosion (attritional damage) and durability dimming hooks.
- Reproduction with gestation, lineage, generation, dynasty, legacy counters, and irregular births.
- Isosceles generational brain-angle heredity (+0.5°/generation, cap at 60°→equilateral) and irregular regularization.
- Optional non-canon compensation system remains available but is OFF by default.
- Contact network, event effects/timeline, fog preview, kill-stroke overlay, sleep/settle anti-jitter.

### Top 10 most novel-faithful items
1. **Women are segments; men are polygons; priests are circles**.
   - Novel anchor: Part I, Section 3 (*Concerning the Inhabitants of Flatland*), Section 11 (*Concerning our Priests*), Section 4 (*Concerning the Women*).
2. **Southward attraction as a “law of nature” and stronger difficulty toward South**.
   - Novel anchor: Part I, Section 2 (*Of the Climate and Houses in Flatland*).
3. **Feeling as safe, practical recognition method with speed-sensitive handling**.
   - Novel anchor: Part I, Section 5 (*Of our Methods of Recognizing one another*).
4. **Sight depends on fog dimness/intensity over distance**.
   - Novel anchor: Part I, Section 6 (*Of Recognition by Sight*).
5. **Women peace-cry as continuous warning signal while moving**.
   - Novel anchor: Part I, Section 4 (*Concerning the Women*).
6. **Isosceles vs equilateral triangle distinction is explicit**.
   - Novel anchor: Part I, Section 3 (*Concerning the Inhabitants of Flatland*).
7. **Irregulars represented and can be corrected/regularized over time**.
   - Novel anchor: Part I, Section 7 (*Concerning Irregular Figures*).
8. **Acute-angle danger model (sharp vertices more dangerous)**.
   - Novel anchor: Part I, Section 3 and Section 5 (angles, danger, tactile recognition context).
9. **Coarse “art of hearing” and voice classes, including imposture channel**.
   - Novel anchor: Part I, Section 5 (*Of our Methods of Recognizing one another*).
10. **High/low female sway quality tied to social class in implementation**.
   - Novel anchor: Part I, Section 4 (*Concerning the Women*), interpreted from classed female motion descriptions.

### Top 10 divergences / assumptions
1. **World topology includes torus mode** (not in novel geometry).
   - Severity: **medium**.
2. **Houses are fully disabled in runtime defaults** despite strong house law content in the novel.
   - Severity: **high**.
3. **Handshake stillness is enforced *after* successful recognition, not strictly as precondition for the felt individual**.
   - Severity: **medium**.
4. **Social movement is BDI-lite gameplay logic, not direct textual behavior laws**.
   - Severity: **medium**.
5. **1D strip renderer and core perception are separate models** (agents do not literally consume the strip samples).
   - Severity: **high**.
6. **Wear/erosion HP model is an extrapolation (game balancing), not explicitly textual physiology.**
   - Severity: **medium**.
7. **Optional intelligence compensation system is non-canon and remains as an assumption path (OFF by default).**
   - Severity: **low**.
8. **No state-law enforcement mechanisms** (e.g., institutional punishment flows, strict police/priest enforcement logic).
   - Severity: **high**.
9. **No color-bill scenario mechanics despite source sections 9–10**.
   - Severity: **high**.
10. **Priest doctrinal/political mechanics are not modeled beyond rank/perception defaults**.
   - Severity: **medium**.

---

## 2. Traceability matrix

| Mechanic / Feature | Novel anchor (Part/Section) | Canon status | User-visible behavior | Core implementation (files + key functions) | Config/UI controls (keys/defaults/where) | Tests / verification |
|---|---|---|---|---|---|---|
| Topology: torus vs bounded | Part I, Sec. 2 (compass/climate orientation context only) | Divergence from the novel (torus); bounded walls are implementation choice | World can wrap or bounce globally; bounded mode has visible border and wall perception | `src/core/topology.ts` `boundaryFromTopology`; `src/systems/movementBehaviors.ts` `applyBoundary`; `src/main.ts` `applyTopology` | `world.config.topology='torus'`; UI `#world-topology` (Simulation) | `tests/topology.test.ts`, `tests/visionFog.test.ts` (bounded walls visible) |
| Solid collisions + separation | No direct textual physics solver | Implementation assumption / extrapolation | Shapes do not pass through each other; are separated and normal velocity removed | `src/systems/collisionSystem.ts` `rebuildCollisionState`; `src/systems/collisionResolutionSystem.ts` `update` | `collisionSlop=0.2`, `collisionResolvePercent=0.8`, `collisionResolveIterations=3` | `tests/collisionResolution.test.ts` |
| Vertex/endpoint stabbing lethality | Part I, Sec. 3 & 5 (acute angles dangerous; tactile risk) | Strongly implied by the novel | Only sharp contacts generate stab severity; death marks emitted | `src/systems/lethalitySystem.ts` `sharpnessFromFeature`, `evaluateDirectionalStab`, `registerKill` | `killSeverityThreshold=7.5`, `stabSharpnessExponent=1.8`, `pressureTicksToKill=120` | `tests/stabLethality.test.ts`, `tests/lethalityBehavior.test.ts`, `tests/killCounter.test.ts` |
| Pressure kill in jams | Not explicitly stated | Implementation assumption / extrapolation | Persistent acute contact eventually kills even at low closing speed | `src/systems/lethalitySystem.ts` `world.stabPressure` logic | `pressureTicksToKill=120` | `tests/stabLethality.test.ts` |
| Erosion / wear attrition | Injury risk is implied; explicit HP is not textual | Implementation assumption / extrapolation | Sliding/rubbing wears hp over time; severe contacts damage more | `src/systems/erosionSystem.ts` `applyWear`, `applyDirectDamage` | `wearEnabled=true`, `wearRate=0.11`, `wearToHpStep=7.5`, `stabHpDamageScale=0.85` | `tests/erosion.test.ts` |
| Touch / feeling recognition | Part I, Sec. 5 | Directly stated in the novel | Safe low-speed contact produces touch events and can update knowledge | `src/systems/feelingSystem.ts` `update`, `canFeel`, `orderedCollisionPairs` | `feelSpeedThreshold=7.5`; per-entity `FeelingComponent` | `tests/feeling.test.ts` |
| Handshake stillness protocol | Part I, Sec. 5 (“felt should stand perfectly still”) | Strongly implied by the novel (partial implementation) | On successful new recognition, both entities get temporary stillness lock | `src/systems/feelingSystem.ts` `requestHandshakeStillness`; `src/systems/stillnessControllerSystem.ts`; `src/systems/movementSystem.ts` stillness skip | `handshakeStillnessTicks=12` | `tests/stillnessHandshake.test.ts`, `tests/stillnessController.test.ts` |
| Peace-cry | Part I, Sec. 4 | Directly stated in the novel | Moving women emit periodic pings; stronger/faster in southern zone | `src/systems/peaceCrySystem.ts` `update`, `isMoving` | `peaceCryEnabled=true`, cadence/radius defaults; south stringency knobs | `tests/peaceCry.test.ts` |
| Hearing + hearing-hit selection | Part I, Sec. 5 | Strongly implied by the novel | Listener stores nearest audible signature/direction deterministically | `src/systems/hearingSystem.ts` `heardSignature`, `update` | `PerceptionComponent` (`hearingSkill`, `hearingRadius`) | `tests/hearingSystem.test.ts` |
| Isosceles voice imposture | Part I, Sec. 5 (hearing weakness, imposture theme) | Strongly implied by the novel | Isosceles can mimic a claimed signature (`Square/Pentagon/HighOrder`) | `src/core/voice.ts`; `src/core/factory.ts` `voiceFromConfig`; `src/systems/hearingSystem.ts` | Spawn UI `#spawn-mimicry-enabled`, `#spawn-mimicry-signature`; Inspector voice row | `tests/hearingSystem.test.ts` |
| Fog principle (comparative dimness enables sight recognition) | Part I, Sec. 6 | Directly stated in the novel | With fog, intensity decays with distance and distance-aware sight recognition is possible; with fog absent, entities can still see presence but not dimness-based distance cue | `src/systems/visionSystem.ts` `update`; `src/render/flatlanderScan.ts` intensity model | `sightEnabled=true`, `fogDensity=0.012`; UI Fog/Sight panel + Flatlander view controls | `tests/visionFog.test.ts`, `tests/flatlanderScan.test.ts` |
| Fog scaling thresholds (`fogMinIntensity`, `fogMaxDistance`) | Part I, Sec. 6 | Implementation assumption / extrapolation | Uses configurable cutoffs to keep sensing bounded and performant | `src/systems/visionSystem.ts` threshold checks | `fogMinIntensity=0.1`, `fogMaxDistance=450` | `tests/visionFog.test.ts` |
| Women = segments + female status + sway | Part I, Sec. 4 | Directly stated (segment), sway quality is strongly implied | Segment women with Low/Middle/High status; sway modulation visible | `src/core/rank.ts`; `src/core/femaleStatus.ts`; `src/systems/swaySystem.ts` | Spawn female rank dropdown; Inspector female/sway readout | `tests/swaySystem.test.ts`, `tests/rank.test.ts` |
| Caste classification | Part I, Sec. 3 and 11 | Directly stated in the novel | Triangle subclasses, gentlemen (4–5), nobles (6+), near-circle, priests, irregular | `src/core/rank.ts` `rankFromShape`; `src/core/rankKey.ts` | `irregularityTolerance=0.08`, `nearCircleThreshold=15` | `tests/rank.test.ts`, `tests/rankKey.test.ts` |
| Canon triangles (equilateral / isosceles metadata) | Part I, Sec. 3 | Directly stated in the novel | Triangle kind persisted and shown in inspector; base ratio on isosceles | `src/core/shapes.ts`; `src/core/factory.ts` `shapeFromConfig`; `src/ui/uiController.ts` `renderSelected` triangle row | Spawn controls `#spawn-triangle-kind`, `#spawn-base-ratio` | `tests/triangleMetadata.test.ts`, `tests/angles.test.ts` |
| South attraction field | Part I, Sec. 2 | Directly stated in the novel | South force ramp by y-zone, women multiplier, damped terminal drift | `src/core/fields/southAttractionField.ts`; `src/systems/southAttractionSystem.ts` | `south*` keys in config/UI | `tests/southAttractionField.test.ts`, `tests/gravity.test.ts`, `tests/southEscape.test.ts` |
| Escapability clamp in south | Not explicitly stated | Implementation assumption / extrapolation | Drift is capped as fraction of propulsion speed (`southEscapeFraction`) | `src/systems/southAttractionSystem.ts` `entityMaxSpeed` + clamp | `southEscapeFraction=0.5` | `tests/southEscape.test.ts` |
| Irregular births (angle deviation model) | Part I, Sec. 7 | Strongly implied by the novel | Male polygon births can be irregular with bounded angle deviation | `src/systems/reproductionSystem.ts` + `generateAngleDeviationRadialProfile`; `src/geometry/polygon.ts` | `irregularBirthsEnabled=true`, `irregularBirthBaseChance=0.14`, cap `2°` | `tests/reproduction.test.ts` (irregular birth determinism/cap) |
| Regularization + promotion from irregular | Part I, Sec. 7 | Strongly implied by the novel | Irregular radial profile converges to regular; rank updated; event emitted | `src/systems/regularizationSystem.ts` `update` | `regularizationEnabled=true`, `regularizationRate=0.15`, `regularityTolerance=0.015` | `tests/regularization.test.ts` |
| Law of Nature (regular male polygon inheritance: +1 side from father) | Part I, Sec. 3 | Directly stated in the novel | Regular polygon father produces male polygon child with one additional side | `src/core/reproduction/offspringPolicy.ts` `determineMaleChildShapeFromParents`; used by `src/systems/reproductionSystem.ts` | Inherits from `maxPolygonSides` world setting if cap applies | `tests/reproduction.test.ts`, `tests/offspringPolicy.test.ts` |
| Male side cap (`maxPolygonSides`) and high-order fertility penalties | Part I, Sec. 3 (principle only) | Implementation assumption / extrapolation | Applies simulation caps/penalties to keep long-run populations stable | `src/core/reproduction/offspringPolicy.ts`; `src/systems/reproductionSystem.ts` | `maxPolygonSides=20`, `maleBirthHighRankPenaltyPerSide=0.085`, `conceptionHighRankPenaltyPerSide=0.13` | `tests/reproduction.test.ts`, `src/tools/stabilityHarness.ts` |
| Isosceles brain-angle generational law (+0.5°/generation; cap 60°) | Part I, Sec. 3 | Directly stated in the novel | Isosceles father begets isosceles son with brain-angle +0.5°; at 60° child is equilateral | `src/core/isosceles.ts`; `src/core/reproduction/offspringPolicy.ts`; `src/core/factory.ts` (`brainAngleDeg` spawn metadata); `src/core/world.ts` (`brainAngles`) | Canon step and cap are fixed in code (`CANON_BRAIN_ANGLE_STEP_DEG=0.5`, `MAX_CANON_BRAIN_ANGLE_DEG=60`) | `tests/offspringPolicy.test.ts` |
| Reproduction + lineage + dynasty/legacy | Generational hierarchy is strongly implied; exact fertility math is not | Implementation assumption / extrapolation | Pregnancy countdown, deterministic births, parent links, generation/dynasty, legacy counts | `src/systems/reproductionSystem.ts`; `src/core/genealogy.ts`; `src/systems/cleanupSystem.ts` | Reproduction panel keys (`gestationTicks`, `matingRadius`, etc.) | `tests/reproduction.test.ts`, `tests/genealogy.test.ts` |
| Non-canon compensation (time/intelligence blunting) | No direct textual numeric law | Implementation assumption / extrapolation | Optional system widens isosceles base over time; used as non-canon smoothing mode | `src/systems/compensationSystem.ts`; intelligence from `src/systems/intelligenceGrowthSystem.ts` | `compensationEnabled=false` by default, `compensationRate=0.4` | `tests/compensation.test.ts` |
| Perimeter eyes + directional glance (limited FOV) | Part I, Sec. 4; Part I, Sec. 6; Part II (Sphere dialogue) | Directly stated (eye on perimeter), directional FOV angle is implementation assumption | Each figure has one perimeter eye and forward glance; scan/vision only sample within eye FOV | `src/core/eyePose.ts` `computeDefaultEyeComponent`, `eyePoseWorld`; `src/core/factory.ts` spawn eye assignment; `src/systems/visionSystem.ts` eye/FOV-gated rays | `defaultEyeFovDeg=180`; Inspector `#inspector-eye-fov` | `tests/eyePose.test.ts`, `tests/visionFog.test.ts` |
| 1D Flatlander retina strip | Part I, Sec. 6 | Strongly implied by the novel | Ray-based strip with nearest-hit occlusion, fog intensity, endpoint/closest markers, using selected eye origin/FOV | `src/render/flatlanderScan.ts` `computeFlatlanderScan` & `extractFlatlanderSegments`; `src/render/flatlanderViewRenderer.ts` | Flatlander panel controls (`rays`, `lookOffset`, `fogDensity`, grayscale, include boundaries); effective FOV from eye | `tests/flatlanderScan.test.ts`, `tests/raycast.test.ts` |
| Event effects + legend + timeline | No direct narrative requirement | Implementation assumption / extrapolation | Distinct glyphs (touch/handshake/peaceCry/stab/death/birth/regularized), sparse eventful timeline | `src/core/events.ts`; `src/render/effects.ts`; `src/ui/eventAnalytics.ts`; `src/render/eventTimelineRenderer.ts` | Event panel toggles + legend/timeline controls | `tests/eventsEffects.test.ts`, `tests/eventAnalytics.test.ts`, `tests/eventDrainPipeline.test.ts` |
| Contact network overlay | No direct textual analog | Implementation assumption / extrapolation | Selected entity shows parent/known edges, with deterministic known-edge selection | `src/render/canvasRenderer.ts` `drawContactNetworkOverlay`; `src/render/contactNetwork.ts` | Overlay toggles under Event/Overlays panel | `tests/contactNetwork.test.ts` |
| Age + deterioration dimming; fog preview | No direct textual requirement (fog preview is interpretive aid) | Implementation assumption / extrapolation | Optional alpha dimming by age/hp; selected-observer fog preview/rings in God view | `src/render/viewModifiers.ts`; `src/render/canvasRenderer.ts` | Overlay toggles (`dim*`, `fogPreview*`) | `tests/viewModifiers.test.ts` |
| Sleep/settle anti-jitter | Not in novel | Implementation assumption / extrapolation | Low-motion entities go asleep; wake on impact; reduces long-run tremble | `src/systems/sleepSystem.ts`; respected in movement/steering systems | `sleepEnabled=true`, eps and thresholds in world config | `tests/sleepSystem.test.ts` |
| Houses & house laws | Part I, Sec. 2 | Divergence from the novel (currently disabled) | House code exists but runtime forces houses off and disables UI controls | `src/core/worldgen/houses.ts` exists; `src/main.ts` `settingsToWorldConfig` forces `housesEnabled:false`; `src/ui/uiController.ts` `syncEnvironmentFieldState` disables fields | Environment panel is present but disabled | `tests/housesDisabled.test.ts` |

---

## 3. Detailed mechanic audits

### 3.1 World topology, borders, and solid collisions
**What the novel says**  
Part I, Section 2 discusses climate, bearings, and houses as orientation aids; it does not define toroidal topology.

**How the app implements it**  
- Global topology is world-level (`torus` or `bounded`) via `src/core/topology.ts` `boundaryFromTopology`.
- Movement applies either wrap or bounce in `src/systems/movementBehaviors.ts` `applyBoundary`.
- Collision detection and manifold generation run each tick in `src/systems/collisionSystem.ts` `rebuildCollisionState`.
- Collision resolution separates overlaps with fixed iterations in `src/systems/collisionResolutionSystem.ts` `update`.

**Key defaults**  
- `topology='torus'` (`src/core/world.ts` `DEFAULT_WORLD_CONFIG`)
- `collisionSlop=0.2`, `collisionResolvePercent=0.8`, `collisionResolveIterations=3`.

**Observe in app**  
1. Set Topology to `Bounded (walls)`.  
2. Start sim and watch edge bounce/clamping and border contact behavior.

**Known divergences/assumptions**  
- Torus mode is purely sim/game convenience and diverges from canonical world geometry.

**Code pointers**  
- `src/core/topology.ts` `boundaryFromTopology`  
- `src/systems/movementBehaviors.ts` `applyBoundary`  
- `src/systems/collisionSystem.ts` `rebuildCollisionState`  
- `src/systems/collisionResolutionSystem.ts` `update`

---

### 3.2 Lethality model: vertex/endpoint stabbing, acuity, pressure, kill attribution
**What the novel says**  
Part I, Sections 3 and 5 emphasize angular danger and tactile risk; acute points are dangerous.

**How the app implements it**  
- Support-feature classification (`vertex|edge|endpoint|circle`) is computed from collision manifolds in `src/systems/collisionSystem.ts`.
- Lethality checks only directional vertex/endpoint attackers (`isVertexAttacker`) in `src/systems/lethalitySystem.ts`.
- Sharpness comes from internal angle (`vertexInternalAngle`) or endpoint max sharpness.
- Total severity combines impact (`sharpness^p * closingSpeed`) and persistent pressure ticks.
- On kill, victim is added to `pendingDeaths`; killer’s `combatStats.kills` and `legacy.deathsCaused` increment; `death` event emitted.

**Key defaults**  
- `killSeverityThreshold=7.5`, `stabSharpnessExponent=1.8`, `pressureTicksToKill=120`, `bluntExponent=0.7`.

**Observe in app**  
1. Spawn fast acute isosceles and slower square targets.  
2. Watch stab events and eventual death markers under sustained pressure.

**Known divergences/assumptions**  
- Exact numeric severity formula and pressure accumulation are extrapolations.

**Code pointers**  
- `src/systems/collisionSystem.ts` `supportFeatureForGeometry`  
- `src/systems/lethalitySystem.ts` `sharpnessFromFeature`, `evaluateDirectionalStab`, `registerKill`

---

### 3.3 Erosion/wear damage
**What the novel says**  
Not explicit as HP mechanics; bodily wear/injury is a reasonable extension of repeated contact danger.

**How the app implements it**  
- Computes tangential sliding speed per manifold.
- Adds wear and periodically converts wear into HP loss.
- Applies additional direct damage from sharp directional contact severity.
- Marks death when hp <= 0.

**Key defaults**  
- `wearEnabled=true`, `wearRate=0.11`, `wearToHpStep=7.5`, `stabHpDamageScale=0.85`.

**Observe in app**  
- Long runs with repeated contacts show gradual dimming (if enabled) and occasional attritional deaths.

**Known divergences/assumptions**  
- HP/wear as scalar durability is implementation extrapolation.

**Code pointers**  
- `src/systems/erosionSystem.ts` `applyWear`, `applyDirectDamage`, `update`

---

### 3.4 Touch/feeling and handshake
**What the novel says**  
Part I, Section 5: tactile recognition is central; safe feeling requires care.

**How the app implements it**  
- Feeling uses collision pairs sorted deterministically by ID.
- Only low relative speed (`<= feelSpeedThreshold`) produces safe touch events.
- Knowledge updates occur when both entities can feel (cooldowns respected).
- Successful new knowledge update emits `handshake`.

**Key defaults**  
- `feelSpeedThreshold=7.5`, `feelingEnabledGlobal=true`, `defaultFeelingCooldownTicks=30`, `defaultFeelingApproachSpeed=10`.

**Observe in app**  
1. Enable event highlights with `Show Feeling`.  
2. Watch touch pulses and handshake marks when low-speed contacts happen.

**Known divergences/assumptions**  
- Knowledge is represented as discrete rank learning, not richer social identification.

**Code pointers**  
- `src/systems/feelingSystem.ts` `update`, `canInitiateFeeling`, `requestHandshakeStillness`  
- `src/core/components.ts` `KnowledgeComponent`, `FeelingComponent`

---

### 3.5 Stillness protocol around handshake
**What the novel says**  
Part I, Section 5: felt must be perfectly still for safe feeling.

**How the app implements it**  
- After a successful handshake (new knowledge), both participants receive stillness ticks.
- Movement system skips integration when `world.stillness.has(id)`.

**Key defaults**  
- `handshakeStillnessTicks=12`.

**Observe in app**  
- Select touching entities; inspect movement freeze for short duration after handshake.

**Known divergences/assumptions**  
- Stillness is post-recognition enforcement, not strict precondition of all feeling attempts.

**Code pointers**  
- `src/systems/feelingSystem.ts` `requestHandshakeStillness`  
- `src/systems/stillnessControllerSystem.ts` `update`  
- `src/systems/movementSystem.ts` (stillness check)

---

### 3.6 Hearing, peace-cry, and imposture
**What the novel says**  
- Part I, Section 4: women’s peace-cry expectation in public movement context.  
- Part I, Section 5: recognition methods include hearing; hearing can be deceptive.

**How the app implements it**  
- PeaceCrySystem emits pings for moving women at cadence/radius; south stringency amplifies cadence/radius in southern zone.
- HearingSystem chooses nearest audible neighbor deterministically and stores signature + direction.
- Isosceles imposture: only isosceles can enable mimicry and claim alternate signature.
- AvoidanceSteering can steer from hearing when sight isn’t used.

**Key defaults**  
- `peaceCryEnabled=true`, cadence `20`, radius `120`.
- `southStringencyEnabled=true`, multiplier `1.9`.
- Voice signatures from `defaultVoiceSignatureForShape`; mimicry defaults off.

**Observe in app**  
1. Enable hearing overlay and select an entity.
2. Watch dashed listener→speaker line when hearing hit exists.
3. Spawn isosceles with voice imposture and inspect heard signature.

**Known divergences/assumptions**  
- No legal punishment workflow for cry non-compliance.

**Code pointers**  
- `src/systems/peaceCrySystem.ts` `update`  
- `src/systems/hearingSystem.ts` `heardSignature`, `update`  
- `src/core/voice.ts` `defaultVoiceComponent`  
- `src/systems/avoidanceSteeringSystem.ts` hearing branch

---

### 3.7 Sight + fog in core perception
**What the novel says**  
Part I, Section 6: recognition by sight depends on comparative dimness under fog.

**How the app implements it**  
- VisionSystem performs deterministic forward multi-ray scan (11 rays by default) over geometry.
- In bounded topology it can detect walls via `raycastWorldBounds`.
- With fog (`fogDensity > 0`): hit acceptance uses `effective = exp(-fogDensity*d) * sightSkill >= fogMinIntensity`, and distance is stored as reliable.
- With no fog (`fogDensity == 0`): presence hits are still recorded, but `distance` is set to `null` (`distanceReliable=false`) to model “equally clear lines” without dimness-based distance cue.
- Avoidance treats fog-free sight hits as uncertain and weak, so hearing/feeling dominates steering.

**Key defaults**  
- `sightEnabled=true`, `fogDensity=0.012`, `fogMinIntensity=0.1`, `fogMaxDistance=450`.

**Observe in app**  
- Set fog density to `0`: entities still get sight presence hits, but distance-aware sight recognition collapses; hearing still works and dominates avoidance.

**Known divergences/assumptions**  
- Core sight and 1D strip both use the same eye pose and per-eye FOV.

**Code pointers**  
- `src/systems/visionSystem.ts` `update`  
- `src/systems/avoidanceSteeringSystem.ts` uncertain sight handling  
- `src/geometry/raycast.ts` `raycastWorldBounds`, shape raycasts

---

### 3.8 Women: segments, female social rank, and back-motion sway
**What the novel says**  
Part I, Section 4: women are line-like; socially constrained movement/behavior.

**How the app implements it**  
- Women are segment shapes (`shape.kind === 'segment'`).
- Female rank/status (`Low/Middle/High`) influences sway amplitude/frequency.
- High rank adds second harmonic modulation.

**Key defaults**  
- Default female rank `Middle`.
- Sway profiles from `swayProfileForFemaleRank`.

**Observe in app**  
- Spawn women with different female ranks and compare oscillatory motion.

**Known divergences/assumptions**  
- Exact sway waveform is an extrapolated signal model.

**Code pointers**  
- `src/core/femaleStatus.ts`  
- `src/systems/swaySystem.ts` `update`  
- `src/core/factory.ts` `femaleStatusFromConfig`

---

### 3.9 Caste/rank hierarchy and triangles
**What the novel says**  
Part I, Section 3 and Section 11: social classes tied to geometric form/regularity.

**How the app implements it**  
- `rankFromShape` maps segment→Woman, circle→Priest.
- Triangle caste kept for both equilateral/isosceles (tagged subclass).
- 4–5 sides→Gentleman; 6..nearCircleThreshold→Noble; otherwise NearCircle.
- Irregular flagged criminal if irregularity beyond tolerance or explicit irregular flag.

**Key defaults**  
- `nearCircleThreshold=15`, `irregularityTolerance=0.08`.

**Observe in app**  
- Use Spawn panel for triangle kind and irregular checkbox; inspect rank labels.

**Known divergences/assumptions**  
- Some legal/social consequences of rank are not modeled.

**Code pointers**  
- `src/core/rank.ts` `rankFromShape`  
- `src/core/rankKey.ts` `rankKeyForEntity`

---

### 3.10 Southward attraction (“gravity”) as zonal field
**What the novel says**  
Part I, Section 2: constant southward attraction, slight in temperate regions.

**How the app implements it**  
- Smoothstep zone multiplier by y fraction (`southAttractionMultiplier`).
- Per-entity damped drift state `SouthDriftComponent.vy` with drag and terminal clamps.
- Women multiplier > 1.
- Escapability cap: drift terminal limited by `southEscapeFraction * entityMaxSpeed`.

**Key defaults**  
- `southAttractionStrength=2`, `southAttractionDrag=12`, `southAttractionMaxTerminal=1.8`, `southEscapeFraction=0.5`, zone `0.75..0.95`, women multiplier `2`.

**Observe in app**  
- Toggle `Show South Zone`; run with bounded topology and inspect stronger drift lower on map.

**Known divergences/assumptions**  
- Exact field shape and damping constants are implementation choices.

**Code pointers**  
- `src/core/fields/southAttractionField.ts`  
- `src/systems/southAttractionSystem.ts` `update`

---

### 3.11 Irregulars: birth, metric, regularization, promotion
**What the novel says**  
Part I, Section 7: irregularity from birth, social/legal handling, potential correction thresholds.

**How the app implements it**  
- Irregular male births can be generated with angle-deviation radial profile (bounded by cap).
- Irregular polygons carry `radial[]`, `maxDeviationDeg`, and `irregular` flags.
- Regularization system lerps radial toward 1.0 based on intelligence; when below tolerance, shape becomes regular and rank recomputed.

**Key defaults**  
- Birth side: `irregularBirthBaseChance=0.14`, `irregularInheritanceBoost=0.12`, cap `2°`.
- Regularization: enabled, rate `0.15`, tolerance `0.015`.

**Observe in app**  
- Run long sim and inspect irregular entries in Inspector (`Regularizing...`, deviation angle).

**Known divergences/assumptions**  
- No explicit courts/hospitals/execution policies from Section 7.

**Code pointers**  
- `src/geometry/polygon.ts` `generateAngleDeviationRadialProfile`, `maxAngleDeviationDegrees`  
- `src/systems/reproductionSystem.ts` irregular birth branch  
- `src/systems/regularizationSystem.ts` `update`

---

### 3.12 Reproduction, gestation, lineage, dynasty, legacy
**What the novel says**  
Generational and class-inheritance structure is present in Part I framing; exact stochastic mating model is not textual.

**How the app implements it**  
- Women (segments) can conceive with nearby male candidate after maturity and cooldown.
- Pregnancy has deterministic countdown; birth spawns child with sex draw.
- Canon law is encoded in a dedicated offspring policy module:
  - Regular polygon father -> male child gets one additional side.
  - Isosceles father -> male child follows brain-angle progression (+0.5° generation step, capped at 60° then equilateral).
  - Female child remains segment.
- Lineage stores mother/father, generation, dynasty (patrilineal fallback logic).
- Legacy tracks births/deathsCaused/handshakes/regularizations/descendants.

**Key defaults**  
- Reproduction ON by default (`true`), `gestationTicks=220`, `matingRadius=52`, `conceptionChancePerTick=0.0027`, `femaleBirthProbability=0.54`, `maxPopulation=500`.
- Canon isosceles heredity constants are fixed in `src/core/isosceles.ts`; side cap (`maxPolygonSides=20`) is simulation scaling.

**Observe in app**  
- Reproduction panel controls; inspector shows fertility/pregnancy and lineage/legacy details.

**Known divergences/assumptions**  
- Male side cap and high-order fertility penalties are balancing assumptions.
- Priest-specific reproduction doctrine not explicitly modeled.

**Code pointers**  
- `src/systems/reproductionSystem.ts` `update`  
- `src/core/reproduction/offspringPolicy.ts` `determineChildSex`, `determineMaleChildShapeFromParents`, `conceptionChanceForFather`  
- `src/core/isosceles.ts` canonical angle-step helpers  
- `src/core/genealogy.ts` helper queries

---

### 3.12.1 Isosceles brain-angle generational law (canonical mechanism)
**What the novel says**  
Part I, Section 3 states that isosceles heredity improves by fixed increments of brain-angle per generation until regularity.

**How the app implements it**  
- Isosceles lineage uses explicit brain-angle metadata (`world.brainAngles`).
- Child brain-angle is deterministic: `child = min(60, father + 0.5)`.
- Conversion between `brainAngleDeg` and `isoscelesBaseRatio` is pure and deterministic.
- At `60°`, offspring is emitted as `triangleKind='Equilateral'` (regular triangle).

**Key defaults**  
- Canon constants are fixed in code:
  - `CANON_BRAIN_ANGLE_STEP_DEG=0.5`
  - `MAX_CANON_BRAIN_ANGLE_DEG=60`

**Observe in app**  
1. Spawn an isosceles lineage and allow male births.  
2. Inspect successive generations; child brain-angle increases by +0.5° until equilateral conversion.

**Known divergences/assumptions**  
- The app preserves optional non-canon compensation as a separate toggle path (`compensationEnabled`), OFF by default.

**Code pointers**  
- `src/core/isosceles.ts`  
- `src/core/reproduction/offspringPolicy.ts`  
- `src/core/factory.ts` (isosceles spawn from `brainAngleDeg`)  
- `tests/offspringPolicy.test.ts`

---

### 3.13 1D Flatlander view
**What the novel says**  
Part I, Section 6: others seen as line-like appearances with dimness gradient by distance.

**How the app implements it**  
- Pure scan module computes nearest hit per ray and fog intensity.
- Scan origin is the selected entity eye point, and angular span is capped by that entity’s eye FOV.
- Groups contiguous hit IDs into segments and marks left endpoint / nearest point / right endpoint.
- Renderer draws tick strip plus marker dots and heading indicator.

**Key defaults**  
- `rays=720`, default eye FOV `180°`, `maxDistance=400`, `fogDensity=0.012`, grayscale ON.

**Observe in app**  
- Select any entity; view strip below world canvas.

**Known divergences/assumptions**  
- Strip uses world raycasts and deterministic visual post-processing; exact retinal phenomenology is interpretive.

**Code pointers**  
- `src/render/flatlanderScan.ts` `computeFlatlanderScan`, `extractFlatlanderSegments`  
- `src/core/eyePose.ts` `eyePoseWorld`  
- `src/render/flatlanderViewRenderer.ts` `render`

---

### 3.14 Event visualization, legend, and timeline
**What the novel says**  
No explicit requirement for symbolic event overlays.

**How the app implements it**  
- Core emits typed world events (`touch`, `handshake`, `peaceCry`, `stab`, `death`, `birth`, `regularized`).
- EventDrainPipeline drains once per tick and fans out to effects and analytics.
- Timeline stores only eventful ticks (sparse histogram).

**Key defaults**  
- Highlights enabled, intensity `1`, cap `120`, legend shown, timeline type filters all ON.

**Observe in app**  
- Event highlight panel + timeline below world and 1D strip.

**Known divergences/assumptions**  
- Pure UX layer; not canon mechanics.

**Code pointers**  
- `src/core/events.ts` `WorldEvent`, `EventQueue`  
- `src/ui/eventDrainPipeline.ts`  
- `src/render/effects.ts` `effectFromEvent`  
- `src/ui/eventAnalytics.ts`, `src/render/eventTimelineRenderer.ts`

---

### 3.15 Contact network, age/hp dimming, fog preview overlays
**What the novel says**  
Not explicit as UI overlays; these are observer aids.

**How the app implements it**  
- Selected entity can display parent and known-contact edges.
- Optional alpha dimming by age and durability.
- Optional selected-observer fog preview and rings in God-view.

**Key defaults**  
- Contact network ON; age dim OFF; deterioration dim ON; fog preview ON.

**Observe in app**  
- Use Overlays controls under Event Highlights panel.

**Known divergences/assumptions**  
- These are explicitly non-canonical debugging/visual aids.

**Code pointers**  
- `src/render/canvasRenderer.ts` `drawContactNetworkOverlay`, fog preview methods  
- `src/render/viewModifiers.ts` `visualAlpha`

---

### 3.16 Sleep/settle anti-jitter
**What the novel says**  
No textual equivalent.

**How the app implements it**  
- Tracks low-speed + low-correction persistence and marks entities asleep after threshold ticks.
- Wakes entities on impacts above `wakeOnImpactSpeed`.
- Movement and steering systems skip asleep entities.

**Key defaults**  
- `sleepEnabled=true`, `sleepSpeedEps=0.15`, `sleepCorrectionEps=0.08`, `sleepAfterTicks=30`, `wakeOnImpactSpeed=0.8`.

**Observe in app**  
- In long runs, stationary clusters stop micro-jittering.

**Known divergences/assumptions**  
- Numerical stabilizer only.

**Code pointers**  
- `src/systems/sleepSystem.ts` `update`  
- checks in `MovementSystem`, `AvoidanceSteeringSystem`, `SocialNavMindSystem`, `FeelingApproachSystem`, `SocialNavSteeringSystem`

---

### 3.17 Houses and environment laws (currently disabled)
**What the novel says**  
Part I, Section 2 contains explicit house orientation and law-like constraints.

**How the app implements it**  
- House generator exists (`spawnHouses`) with pentagon/square/triangle-fort logic and east/west doors.
- Runtime currently forces `housesEnabled=false`; UI environment controls are disabled.

**Key defaults**  
- `housesEnabled=false`, `houseCount=0`.

**Observe in app**  
- No houses appear in default runs.

**Known divergences/assumptions**  
- This is a deliberate divergence from narrative environment richness.

**Code pointers**  
- `src/core/worldgen/houses.ts` `spawnHouses`  
- `src/main.ts` `settingsToWorldConfig` (hard-disable), callback comment “intentionally disabled”  
- `src/ui/uiController.ts` `syncEnvironmentFieldState`

---

### 3.18 System order, deterministic invariants, and narrative-vs-engine split
**Tick order (from `src/main.ts` `systems` array):**
1. `StillnessControllerSystem`
2. `SouthAttractionSystem`
3. `IntelligenceGrowthSystem`
4. `SleepSystem`
5. `PeaceCrySystem`
6. `HearingSystem`
7. `VisionSystem`
8. `SocialNavMindSystem`
9. `SocialNavSteeringSystem`
10. `AvoidanceSteeringSystem`
11. `FeelingApproachSystem`
12. `MovementSystem`
13. `SwaySystem`
14. `CompensationSystem`
15. `RegularizationSystem`
16. `CollisionSystem`
17. `FeelingSystem`
18. `CollisionResolutionSystem`
19. `ErosionSystem`
20. `LethalitySystem`
21. `CleanupSystem`
22. `ReproductionSystem`

**Per-system I/O walk (read/write summary):**

| System | Primary reads | Primary writes | Notes |
|---|---|---|---|
| `SouthAttractionSystem` | `transforms`, `shapes`, `movements`, `config.south*` | `southDrifts` | Computes damped south drift and escapability clamp. |
| `IntelligenceGrowthSystem` | `ranks`, `handshakeCounts`, `config.intelligence*` | `intelligence`, clears `handshakeCounts` | Intelligence grows by time + handshake bonus. |
| `StillnessControllerSystem` | `stillness`, `stillnessRequests` | `stillness` | Decrements/removes stillness timers and applies prioritized stillness requests. |
| `SleepSystem` | `movements`, `lastCorrections`, `manifolds`, `config.sleep*` | `sleep` | Sleep/wake state machine for anti-jitter. |
| `PeaceCrySystem` | `ranks`, `peaceCry`, `movements`, `transforms`, `config.peaceCry*`, south zone | `audiblePings`, `events` (`peaceCry`), `peaceCry.lastEmitTick` | Women-only emissions when moving. |
| `HearingSystem` | `perceptions`, `transforms`, `voices`, `ranks`, `audiblePings` | `hearingHits` | Nearest heard signature with deterministic tie-break. |
| `VisionSystem` | `vision`, `perceptions`, `transforms`, `shapes`, `config.fog/sight/topology` | `visionHits` | Raycast-based nearest sight hazard/entity (incl. walls); fog-free mode records presence with unreliable distance. |
| `SocialNavMindSystem` | `movements(socialNav)`, `visionHits`, `collisions`, `knowledge`, `fertility`, `ages`, `ranks` | `movements(socialNav intention/goal/timers)` | Chooses intentions from perceived data + emergencies. |
| `SocialNavSteeringSystem` | `movements(socialNav)`, `transforms`, `feeling` | `movements(socialNav heading/speed smoothing)`, `transforms.rotation` | Harmonic steering update toward goals. |
| `AvoidanceSteeringSystem` | `movements(non-social)`, `visionHits`, `vision`, `hearingHits`, `audiblePings`, `sleep` | `movements.heading` | Steering away from seen/heard hazards. |
| `FeelingApproachSystem` | `movements(non-social)`, `transforms`, `feeling`, `knowledge`, `ranks`, `config.feeling*` | `movements.heading/speed` | Slow approach toward unknown nearby contacts. |
| `MovementSystem` | `movements`, `transforms`, `southDrifts`, `sleep`, `stillness`, `staticObstacles` | `transforms`, `movements` | Integrates movement behavior + boundaries. |
| `SwaySystem` | `shapes`, `femaleStatus`, `sway`, `movements`, `transforms`, `southDrifts` | `sway.phase`, `transforms.rotation` | Segment orientation oscillation. |
| `CompensationSystem` | `shapes` (isosceles), `intelligence`, `config.compensation*` | `shape.vertices`, `shape.isoscelesBaseRatio`, `shape.irregularity`, `brainAngles` | Optional non-canon blunting mode (OFF by default). |
| `RegularizationSystem` | `shapes` (irregular radial), `intelligence`, `ranks`, `transforms`, `config.regularization*` | `shapes`, `irregularity`, `ranks`, `events` (`regularized`), `regularizedThisTick`, `legacy` | Converges irregular polygons to regular and promotes rank. |
| `CollisionSystem` | `entities`, `shapes`, `transforms`, `movements`, `southDrifts`, `config.collision*` | `geometries`, `collisions`, `manifolds` | Broad-phase + manifold generation + support features. |
| `FeelingSystem` | `collisions`, `geometries`, `movements`, `southDrifts`, `ranks`, `knowledge`, `feeling`, `config.feel*` | `events` (`touch`,`handshake`), `knowledge`, `stillness`, `handshakeCounts`, `feeling.lastFeltTick`, `legacy` | Safe tactile recognition and handshake protocol. |
| `CollisionResolutionSystem` | `manifolds`, `transforms`, `movements`, `pendingDeaths`, `config.collision*` | `transforms`, `movements`, `lastCorrections` | Position correction + velocity projection against normals. |
| `ErosionSystem` | `manifolds`, `movements`, `southDrifts`, `durability`, `geometries`, `config.wear*` | `durability`, `pendingDeaths`, `events` (`death`) | Wear and direct damage accumulation. |
| `LethalitySystem` | `manifolds`, `geometries`, `durability`, `config.kill*`, `staticObstacles` | `pendingDeaths`, `stabPressure`, `combatStats`, `legacy`, `events` (`stab`,`death`) | Manifold-based stabbing death model. |
| `CleanupSystem` | `pendingDeaths`, all component maps, `lineage`, `legacy` | Removes dead IDs from world maps; `deathsThisTick`; cleans `stabPressure` | Safe end-of-tick deletion pass. |
| `ReproductionSystem` | `entities`, `ages`, `fertility`, `pregnancies`, `shapes`, `transforms`, `lineage`, `legacy`, `config.reproduction*` | `ages`, `pregnancies`, new entity/components via spawn, `brainAngles`, `lineage`, `legacy`, `events` (`birth`) | Gestation, canon offspring policy (+1 sides / isosceles brain-angle progression), and lineage updates. |

**Determinism invariants (implemented):**
- Fixed timestep (`src/core/simulation.ts` `stepOneTick`, `tickRate=30`).
- Stable entity order by numeric ID (`src/core/world.ts` `getSortedEntityIds`).
- Stable pair sorting (`src/core/events.ts` `orderedEntityPairs`; manifold sort in collision system).
- RNG uses seeded `SeededRng` from world; no render-layer RNG.
- Event drain exactly once per tick (`src/ui/eventDrainPipeline.ts`).

**Narrative systems**: south attraction, hearing/vision, peace-cry, feeling/handshake, lethality/erosion, sway, canonical reproduction/lineage/isosceles heredity, regularization.  
**Pure engine/UX systems**: collision resolution, event effects/timeline, contact network overlays, sleep stabilization, camera/picking.

---

## 4. What’s missing (from the novel)

### Low effort / high ROI
1. **Explicit textual hints in UI for canonical section anchors** (e.g., tooltip labels “Part I, Sec. 5”).  
   - Novel anchor: Sections 4–7.
2. **Optional strict peace-cry compliance mode** (currently no legal consequences).  
   - Novel anchor: Part I, Section 4.
3. **Expose fog comparative-dimness explanation directly in 1D panel legend** (currently mostly implicit).  
   - Novel anchor: Part I, Section 6.
4. **Explicit irregularity policy mode labels** (lenient vs severe state) without changing mechanics.  
   - Novel anchor: Part I, Section 7.

### Medium
1. **House-law environment re-enable with canon constraints** (pentagonal default, sexed door convention, square/triangle restrictions by town policy).  
   - Novel anchor: Part I, Section 2.
2. **Hearing/sight social inference stratification by class** beyond current coarse signatures.  
   - Novel anchor: Part I, Section 5 and Section 6.
3. **Priestly institutional influence mechanics** (currently priest mostly just rank/perception profile).  
   - Novel anchor: Part I, Sections 11–12.

### High
1. **Colour Bill / Chromatic Sedition scenario mechanics**.  
   - Novel anchor: Part I, Sections 9–10.
2. **State institutions around irregulars (inspection, sanction, surgery pathways)** with policy variants.  
   - Novel anchor: Part I, Section 7.
3. **Richer doctrinal/political simulation for priestly order**.  
   - Novel anchor: Part I, Section 12.
4. **Part II metaphysical/epistemic scenario mode** (Lineland/Spaceland teaching conflict).  
   - Novel anchor: Part II, Sections 13–22.

---

## 5. Questions for maintainers
1. Should canonical faithfulness prioritize **strict textual law simulation** (institutions/punishments), or remain a **behavioral sandbox with canonical flavor**?
2. For handshake canon compliance, do you want stillness to be a **hard precondition before recognition** (stricter than current post-handshake stillness)?
3. Should the AI policy consume the **same 1D strip samples** shown in UI, or is current separate core vision model acceptable?
4. Should houses remain intentionally disabled, or should Part I, Section 2 constraints return as a default environment mode?
5. Are AGENTS population bands intended as canon targets or strictly pragmatic simulation-health thresholds?
6. For irregular handling, should there be explicit switchable regimes (severe vs lenient) tied to Section 7 interpretations?
7. Should peace-cry be merely advisory (current), or law-enforced in a strict mode?
8. Do you want priest-specific fertility/behavior constraints added, or keep priests as high-rank circles only?

---

## Appendix A — Stability harness audit note
- Harness file: `src/tools/stabilityHarness.ts`.
- It reports women/triangles/gentlemen/nobles/near+priests distribution, births/deaths, average generation across fixed seed set.
- AGENTS contract (`AGENTS.md`) defines target percentage bands.
- **Canon status of bands:** these are **pragmatic simulation constraints**, not direct quantitative claims from Abbott’s text.

## Appendix B — Canon status labels used
- **Directly stated in the novel**: explicit in cited section wording.
- **Strongly implied by the novel**: not verbatim rule, but directly consistent with narrative mechanics.
- **Implementation assumption / extrapolation**: simulation/UX engineering choice added for playability or observability.
- **Divergence from the novel**: current behavior or default contradicts/omits a clear canonical element.
