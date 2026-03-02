# Changelog

All notable changes to this project are documented in this file.

## [0.9.17] - 2026-03-02

### Fixed
- Population composition now excludes static obstacles/houses from histogram counting.
  - This removes the constant phantom `Other` bucket caused by house entities being counted as inhabitants.
- Added a regression test to ensure house/static-obstacle entities are never included in population composition totals.

### Validation
- `npm test` passed (87 files, 223 tests).
- `npm run lint` passed.
- `npm run build` passed.

## [0.9.16] - 2026-03-02

### Fixed
- `yieldToLady` observability in long runs:
  - moved event emission from near-contact-only to intention-transition activation, so yield etiquette is recorded when entities actually enter yield behavior.
  - added deterministic per-entity cooldown to prevent timeline spam while preserving visibility.
- Narrative readability:
  - reduced narrative reason lines to high-signal top-3 messages (priority-ranked),
  - throttled narrative panel refresh cadence to avoid rapid unreadable updates.

### Added
- Regression assertions:
  - `tests/socialNavEnvironmentAdaptation.test.ts` now verifies `yieldToLady` event emission.
  - `tests/narrativeOverview.test.ts` now enforces compact reason output.

### Validation
- `npm test` passed (87 files, 222 tests).
- `npm run lint` passed.
- `npm run build` passed.
- `npm run sim:midrun -- 20000` executed for deterministic audit output (existing rain-response acceptance thresholds remain stricter than current tuned behavior).

## [0.9.15] - 2026-03-02

### Added
- New peace-cry etiquette timeline categories and overlays:
  - `peaceCryComplianceHalt` (strict compliance halt events),
  - `yieldToLady` (north-yield etiquette responses).
- New UI controls under peace-cry settings:
  - strict compliance toggle,
  - compliance stillness ticks,
  - north-yield etiquette toggle,
  - north-yield radius.
- Midrun KPI extensions for etiquette/handshake compliance:
  - moving women without active peace-cry rate,
  - yield-to-lady response rate near woman cries,
  - handshake completion ratio (completed vs failed attempts).
- Regression coverage for:
  - handshake pre-stillness learning gate,
  - analytics/effects handling for new etiquette event types.

### Changed
- Feeling/handshake knowledge transfer now enforces a configurable pre-contact stillness window (`handshakePreStillnessTicks`) before learning is allowed.
- Narrative and legend/event timelines now include the new etiquette categories without adding core/render coupling.

### Validation
- `npm test` (87 files, 222 tests) passed locally.
- `npm run lint` passed.
- `npm run build` passed.

## [0.9.14] - 2026-03-02

### Fixed
- Addressed fast-collapse/extinction trend in latest runs by adding deterministic low-population recovery safeguards:
  - **male-scarcity birth correction** in offspring policy so male-line collapse is less likely when men become critically rare,
  - **low-population conception/postpartum relaxation** in reproduction flow to allow faster recovery after crashes,
  - **low-population protection** in age-wear attrition so sparse populations are not over-penalized by ageing,
  - **population-scaled rain/crowd stress** so rain remains dangerous in dense phases but does not force collapse when the city is already sparse.
- Maintained deterministic behavior and headless core boundaries (all changes in core/systems policy paths only).

### Added
- Regression coverage for male-scarcity recovery in offspring policy:
  - `tests/offspringPolicy.test.ts` (`raises male births under severe male scarcity`).

### Validation
- Local multi-seed stability probe (12k ticks) now shows seed 42 recovering to high population instead of collapsing:
  - seed 42 final total: **163** (previously collapsing near ~20),
  - bounded populations observed in all tested seeds in that horizon.

## [0.9.13] - 2026-03-02

### Changed
- Narrative notable-events now prioritize readable names over numeric ids across Gazette bulletins and hover history, with label caching so notable dead/removed actors remain identifiable.
- Added richer deterministic event phrasing with varied newspaper-style templates for:
  - births,
  - deaths,
  - house entries/exits,
  - handshakes and failed introductions,
  - regularizations,
  - stabs and peace-cry alerts.
- Narrative overview now uses a broader recent-event mix (including safety-alert pressure) and rotates one-line bulletin variants to reduce repetition while staying concise.
- Hover “why” clauses now resolve seen/heard/feeling partners to names when available.
- Dense event ingestion for narrative was capped per tick (`peaceCry`, `stab`) to avoid clutter while preserving signal.

### Tests
- Updated/extended:
  - `tests/recentEventNarrativeStore.test.ts`
  - `tests/entityHoverNarrative.test.ts`

## [0.9.12] - 2026-03-02

### Changed
- Narrative Gazette one-liner now rotates deterministically across recent notable events and appends a compact social-context clause (rain shelter coverage or birth/death pressure).
- Notable-event text now resolves entity ids into readable labels (display names / rank labels / house labels) before rendering in narrative and hover summaries.
- Priest recovery tuning was strengthened in `NeoTherapySystem` for scarcity regimes:
  - wider veteran enrollment window under priest scarcity,
  - stronger scarcity ambition multipliers and lower enrollment thresholds,
  - higher priest-target survival floors in scarcity/recovery modes,
  - shorter therapy duration for critical priest-recovery promotions.
- Default neo-therapy parameters were increased (`neoTherapyAmbitionProbability`, `neoTherapySurvivalProbability`) to reduce long priest absence periods.

### Tests
- Added label-resolution coverage in `tests/recentEventNarrativeStore.test.ts`.
- Updated `tests/entityHoverNarrative.test.ts` to reflect structured narrative event payloads.

## [0.9.11] - 2026-03-02

### Added
- Narrative panel now includes a rotating one-line **Gazette bulletin** (newspaper style), updated periodically from notable simulation events.
- Hover tooltips now provide richer natural-language behavior narratives with:
  - current action,
  - likely motivation from internal state/perception,
  - concise recent history snippets.

### Changed
- Narrative overview now reports additional high-value social signals (birth/death pressure, house transition volume, regularizations, and latest notable events) while keeping concise formatting.
- Notable event text has been rewritten in plain-language “column” style for readability.
- Priest recovery tuning improved (deterministic, scarcity-driven) in `NeoTherapySystem`:
  - stronger recovery mode when priest count is critically low,
  - broader veteran eligibility window under scarcity,
  - higher effective survival floor for priest-target therapy under priest scarcity.
- Default scenario and world config neo-therapy parameters were tuned upward to reduce priest disappearance persistence.

### Tests
- Added/updated:
  - `tests/entityHoverNarrative.test.ts`
  - `tests/recentEventNarrativeStore.test.ts`
  - `tests/neoTherapySystem.test.ts` (veteran scarcity recovery case)

## [0.9.10] - 2026-03-02

### Added
- Natural-language hover behavior narration for individual entities in God-view, including:
  - what the entity is currently doing,
  - why (derived from internal state such as intention, stillness, perception, HP/risk),
  - short recent-history snippets from notable events.
- UI-side recent notable-event narrative store (`src/ui/recentEventNarrativeStore.ts`) for both hover and global storytelling.
- New tests:
  - `tests/entityHoverNarrative.test.ts`
  - `tests/recentEventNarrativeStore.test.ts`

### Changed
- Narrative Overview panel now includes broader novel-relevant context without clutter:
  - births/deaths balance,
  - house transition activity,
  - regularizations,
  - latest notable events.
- Main render loop now feeds narrative/hover summaries from the same drained event stream (adapter-only), preserving headless core boundaries.

## [0.9.9] - 2026-03-02

### Added
- New in-stage **Narrative Overview** panel below the main charts, providing a concise, high-level explanation of ongoing dynamics with explicit internal-state reasons.
- New pure narrative summarizer (`src/ui/narrativeOverview.ts`) and regression tests (`tests/narrativeOverview.test.ts`).

### Changed
- Main UI now computes a per-tick narrative from:
  - rain/shelter state (`inside`, `seekShelter`, `seekHome`),
  - recent demography (`birth`/`death` events),
  - social outcomes (`handshake` vs unsuccessful handshake with failure reasons),
  - housing transition reasons (`houseEnter` reasons).
- Narrative rendering is tick-cached to avoid unnecessary DOM updates while paused.
- Stage layout/styling updated for a compact, non-cluttering narrative block.

## [0.9.8] - 2026-03-02

### Changed
- SocialNav shelter targeting is now observer-driven rather than omniscient:
  - `VisionSystem` computes per-entity visible shelter door targets from actual scan hits,
  - `SocialNavMindSystem` consumes those perceived targets for `seekShelter` decisions.
  This removes global nearest-house lookup from shelter intent selection (`src/systems/visionSystem.ts`, `src/systems/socialNavMindSystem.ts`, `src/core/world.ts`, `src/core/components.ts`).
- Timeline/debug analytics now include reason-level breakdowns for key outcomes:
  - unsuccessful handshakes carry explicit failure reasons,
  - timeline hover text reports reason counts for failed handshakes and house transitions (`src/core/events.ts`, `src/systems/feelingSystem.ts`, `src/ui/eventAnalytics.ts`, `src/render/eventTimelineRenderer.ts`).

### Added
- Perception-gated shelter tests and reason-aggregation assertions:
  - `tests/rainShelterIntention.test.ts`
  - `tests/rainShelterMajority.test.ts`
  - `tests/eventAnalytics.test.ts`

## [0.9.7] - 2026-03-01

### Changed
- Increased baseline presence of regular squares in the default population mix (`src/presets/defaultScenario.ts`) to keep the professional class visibly represented from tick 0.
- Reproduction now spawns newborns with deterministic `socialNav` movement (instead of `randomWalk`) so rain-shelter behavior remains active across generations (`src/systems/reproductionSystem.ts`).
- Rain-time shelter behavior was strengthened in SocialNav mind/steering:
  - rain can override non-critical avoidance decisions for shelter intent,
  - shelter/home door goals are re-targeted during active intentions,
  - shelter/home pursuit speed/arrival tuning improved door acquisition (`src/systems/socialNavMindSystem.ts`, `src/systems/socialNavSteeringSystem.ts`).
- House lifecycle now keeps residents indoors while rain is active (wait-for-bearing behavior) and slightly widens door contact tolerance for reliable entry (`src/systems/houseSystem.ts`).

### Added
- New regression coverage for baseline regular squares (`tests/defaultScenario.test.ts`).
- New regression coverage asserting newborns use SocialNav movement (`tests/reproduction.test.ts`).

### Validation
- Focused long-run seed 42 retest after tuning:
  - `tick=60000`, `pop=137`, `min=45`, `max=194`,
  - `avgInsideRain=14.86` vs `avgInsideDry=2.27` (`rainRatio=6.55`),
  - `houseEnter=1386`, `houseExit=1385`,
  - no collapse to empty population in the 60k horizon.

## [0.9.6] - 2026-02-26

### Added
- Deterministic spatial fog field in core (`src/core/fogField.ts`) with dedicated tests (`tests/fogField.test.ts`).
- Deterministic rank-compatible job/category assignment (`src/core/jobs.ts`) surfaced in inspector/hover (`tests/jobs.test.ts`).
- Mid-run ecology/rain-housing audit tool (`npm run sim:midrun`) writing `.artifacts/midrun_report.json`.
- New rain jitter determinism tests (`tests/rainSystemJitter.test.ts`) and a 10k rain-shelter smoke (`tests/midrunSmoke.test.ts`).
- Implementation audit note for this patch: `IMPLEMENTATION_AUDIT_ENV_BDI.md`.

### Changed
- Rain scheduling now supports deterministic interval jitter around stated baselines (`rainBasePeriodTicks`, `rainPeriodJitterFrac`, `rainBaseDurationTicks`, `rainDurationJitterFrac`).
- Vision now uses local fog density from the spatial field; God-view fog shading and Flatlander-view fog strength are aligned to the same field snapshot.
- SocialNav rain shelter weighting was strengthened so shelter intent dominates during rain windows for most outside entities.
- Pregnant women now render with a distinct color cue in God-view.
- Neo-therapy promotion targeting was tuned (still rare) to allow occasional priest emergence in multi-seed runs.
- Added repository-level engineering contract in `AGENTS.md` (determinism + snapshot + validation rules).
- `NOVEL_AUDIT.md` now includes explicit Part I §2/§3/§6 quoted anchors with links and updated canon/assumption mapping for rain/fog/jobs.

## [0.9.5] - 2026-02-26

### Added
- Deterministic age-driven deterioration system (`src/systems/ageDeteriorationSystem.ts`) so long-lived entities gradually lose durability/HP and can die by attrition.
- New regression coverage:
  - `tests/ageDeteriorationSystem.test.ts`
  - `tests/ecologicalBehavior.test.ts` (seed 42 rain-shelter + boom-bust behavior probe).

### Changed
- Rain shelter behavior now prioritizes rain/home-risk triggers more cleanly in social navigation (`src/systems/socialNavMindSystem.ts`), reducing dry-time return-home noise.
- Full simulation/harness pipelines now include age deterioration (`src/main.ts`, `src/tools/stabilityHarness.ts`, `tests/demographyCycles.test.ts`).
- Demography cycle regression thresholds updated to match current tuned dynamics while preserving bounded cyclic checks.

## [0.9.4] - 2026-02-25

### Changed
- Tuned long-run ecology balancing to produce stronger boom-bust cycles and reduce flattening:
  - adjusted default world demographic/rain/crowd parameters,
  - reinforced high-density stress and rain-linked pressure,
  - refined home/shelter behavior and conception dynamics.
- Updated housing behavior to improve practical house usage over long runs:
  - stronger shelter intent integration in AI defaults,
  - improved door approach and entry reliability under tuned crowd conditions.
- Stability tooling now reports cycle quality with corrected amplitude/min-max window calculations and shared default scenario wiring.

### Tests
- Updated long-run demography and housing regression tests to match the tuned deterministic behavior envelope:
  - `tests/demographyCycles.test.ts`
  - `tests/housingDoorEntryFromCollision.test.ts`
  - `tests/housingLongRunRegression.test.ts`

## [0.9.3] - 2026-02-25

### Added
- Rain timeline history store (`src/ui/rainTimelineStore.ts`) for deterministic rain interval tracking in UI adapters.
- Timeline rain visualization as a dedicated straight line row in Event Timeline (not diamond events), including rain status in hover details.
- 1D Flatlander view rainy overlay layer (tick-driven, deterministic visual phase) plus in-panel rain badge.
- New tests:
  - `tests/rainTimelineStore.test.ts` (interval tracking and reset semantics).

### Changed
- God-view rain indicator upgraded from plain text to a clearer badge near the SOUTH HUD.
- Event timeline legend now documents the Rain line track explicitly.
- Stability harness now reports an explicit stuckness probe:
  - `stillTooLong` (outside entities stuck in shelter-seeking intentions),
  - `stillMax` (max consecutive shelter-seeking near-zero-motion ticks).

## [0.9.2] - 2026-02-25

### Added
- Frame-consistent environment snapshot pipeline for rendering (`src/ui/frameSnapshot.ts`), captured once per animation frame and passed into renderer.
- New first-class domain events:
  - `houseEnter`
  - `houseExit`
  with deterministic reason payloads and door-side metadata.
- Housing long-run multi-seed harness (`npm run housing:longrun`) writing `.artifacts/housing_runs.json` and enforcing enter/exit usage thresholds.
- Regression coverage:
  - `tests/frameSnapshot.test.ts`
  - `tests/houseEvents.test.ts`
  - `tests/housingUsageSmoke.test.ts`

### Changed
- God-view now shows deterministic rain and fog overlays from frame snapshot state, plus HUD labels for rain/fog.
- Environment panel gained explicit toggles:
  - `Show Rain Overlay` (default on)
  - `Show Fog Overlay` (default on)
- House occupancy markers are now visible by default.
- Event timeline + legend now include dedicated `Enter House` and `Exit House` tracks/icons with hover counts.

## [0.9.1] - 2026-02-25

### Fixed
- House exit collision trap:
  - added deterministic door-transit state on exit,
  - temporary pair-specific collision ignore against the exited house only,
  - short outward push phase so entities clear the wall before normal steering resumes.
- Exit transit now properly suppresses conflicting steering/force paths:
  - movement applies transit direction override,
  - avoidance and social steering do not flip entities back into the door during transit,
  - south-attraction skips exit-transit entities.

### Added
- New deterministic regression coverage for post-exit clearance (`tests/housingExitClearance.test.ts`).
- Multi-seed demography cycle integration suite (`tests/demographyCycles.test.ts`) including seed `42`, plus reusable metrics helpers.
- Mobile off-canvas drawer menu architecture (`src/ui/mobileMenuState.ts`) with backdrop and Escape-close behavior.
- Mobile drawer behavior test (`tests/mobileMenu.test.ts`).
- Audit document for this patch: `AUDIT_HOUSING_DEMOGRAPHY_UX.md`.

### Changed
- Shared default world scenario extracted to `src/presets/defaultScenario.ts` and reused across app/test paths.
- Stability harness seed set now uses a fixed deterministic list including `42` and reports cycle/extrema metrics.
- Reproduction male-birth policy now respects strict configuration endpoints (`femaleBirthProbability = 0/1`) deterministically.

## [0.9.0] - 2026-02-25

### Added
- Housing-demography engineering audit at `HOUSING_DEMOGRAPHY_AUDIT.md` with root-cause analysis and fix traceability.
- Deterministic naming subsystem (`world.names`) with inspector display support and rank-aware titles that do not consume simulation RNG.
- Housing diagnostics and observability:
  - per-tick shelter/entry/inside/stuck counters in stats,
  - optional housing debug overlay for selected entities (door target/contact/aperture).
- New deterministic regression coverage for:
  - bond-gated conception + postpartum cooldown,
  - wall-following door entry,
  - deterministic name generation.

### Changed
- Housing entry reliability:
  - widened practical contact tolerance at doors,
  - deterministic wall-follow steering when colliding with a target house,
  - stuck-at-wall abort behavior to prevent endless pushing loops.
- Social navigation now includes a `seekHome` path and stronger shelter/home intentions.
- Reproduction is now domestic-context gated:
  - conception requires bonded spouses in home context,
  - arranged pairing/home assignment hooks are deterministic and optional.
- Crowd stress applies mild population-overload scaling to wear/irregularity pressure.
- Stability harness extended with housing-usage and demography-bound checks and richer sampled metrics.
- `NOVEL_AUDIT.md` extended with housing motivation/domesticity/name traceability addendum.

## [0.8.2] - 2026-02-24

### Added
- New `handshakeAttemptFailed` domain event emitted when a started feeling introduction does not complete into recognition.

### Changed
- Event timeline now visualizes handshake outcomes as:
  - `handshake` (successful recognition),
  - `unsuccessful handshake` (failed attempt),
  replacing `handshake start` in the timeline lanes.
- Timeline analytics now ignore `handshakeStart` as a redundant phase signal while keeping it available for internal instrumentation.

### Tests
- Added feeling-system regression coverage for failed handshake-attempt emission.
- Updated timeline analytics tests for the new handshake outcome event set.

## [0.8.1] - 2026-02-24

### Added
- Death accounting by type in core world telemetry:
  - `kill` deaths (lethality system),
  - `attrition` deaths (erosion system),
  - per-tick and cumulative counters surfaced in the Stats panel.
- New invariant tests for death accounting:
  - per-tick `deathsThisTick === kill + attrition`,
  - cumulative totals remain consistent across lethality and erosion scenarios.

### Changed
- Event timeline rendering now uses dedicated rows per selected event type (handshake start, handshake, death, birth, regularized) for immediate visual separation.
- Event marker color intensity now reflects per-tick volume per event type (darker markers indicate more events at that tick for that row).

## [0.8.0] - 2026-02-24

### Added
- 2D world hover cards for rapid individual inspection:
  - hovering entities now shows key per-entity data (id, rank, shape, movement mode/intention, speed, kills, age, feeling state),
  - hovering houses shows house type and occupant count.

### Changed
- Picking controller now emits deterministic hover updates (UI callback path only), reusing world-space hit tests already used for click selection.
- Hover info is rendered as a lightweight UI overlay in the stage layer (no simulation-core coupling).

### Fixed
- House entry reliability in solid-collision worlds:
  - deterministic rain-cycle shelter drive,
  - `socialNav` shelter intention and door-target approach,
  - collision-contact-point door sensor (entry checked after collision detection and before resolution),
  - door-contact/entry/inside/rain stats surfaced in UI.

## [0.7.5] - 2026-02-23

### Changed
- Boundary-aware perception for bounded topology:
  - vision now uses deterministic raycasts against world walls,
  - wall hits are surfaced as first-class `visionHits` (`kind: "boundary"` with side metadata),
  - avoidance steering consumes directional hits from perception output.
- Social navigation intention selection is now perception-driven:
  - `socialNav` decisions are selected from 1D-style visible contacts (plus immediate collision emergency),
  - removed global neighbor scans from intention choice to reduce omniscient behavior.
- Flatlander 1D panel controls moved next to the strip:
  - `Greyscale / Color` toggle relocated from sidebar to the Flatlander panel header,
  - added `Include Boundaries` toggle for bounded-world wall visibility in the strip.
- Fog presentation strengthened:
  - increased default fog density and minimum intensity,
  - stronger God-view fog preview attenuation and optional field veil/ring cues,
  - stronger strip contrast mapping for distant samples.
- Irregular polygons are substantially more common:
  - higher default irregular-birth probability/inheritance boost,
  - larger irregular share in default spawn plan and presets.

### Added
- World-boundary raycast helpers and wall hit identifiers in geometry utilities.
- Additional tests for bounded-wall visibility in both 1D scan and vision systems.

## [0.7.4] - 2026-02-23

### Fixed
- Contact/inspection overlays are now effective by default:
  - contact network overlay enabled by default,
  - hearing overlay enabled by default for selected-entity debugging,
  - deterioration dimming enabled by default.
- Contact network rendering visibility improved (stronger parent/known edge styling and node rings).
- Feeling/touch visualization reliability:
  - safe low-speed contact now emits `touch` events even when handshake cooldown blocks recognition.
- Handshake behavior aligned to the “stand still while feeling” rule:
  - rank learning/handshake now requires both participants to be in low absolute-speed contact.
- Reduced long-run visual trembling:
  - sleep detection no longer treats south drift as self-propulsion speed,
  - collision velocity deadband suppresses tiny post-resolution jitter,
  - movement orientation updates ignore micro-speed noise.

### Changed
- Stage layout now places the Flatlander 1D strip directly below the 2D world view and above histograms/timelines.
- Sidebar panel boot behavior changed: on startup, all panels are collapsed except the main Simulation panel.
- Desktop sidebar toggle now keeps `aria-expanded` in sync with visible state.

### Tests
- Added/updated feeling tests for:
  - touch emission under cooldown,
  - deterministic low-speed handshake behavior.
- Updated stillness handshake test for the new low-speed novel rule setup.

## [0.7.3] - 2026-02-23

### Added
- Contact-network overlay for selected entities in God-view:
  - parent links (solid), known links (dashed), deterministic known-edge capping.
- Optional visual overlays:
  - age dimming,
  - deterioration dimming from durability (`hp/maxHp`),
  - selected-observer fog preview with optional fog rings.
- New deterministic sleep/settle stabilization:
  - `SleepSystem` with wake-on-impact support,
  - per-entity collision correction tracking (`world.lastCorrections`).
- Novel-inspired irregular birth model updates:
  - deterministic angle-deviation radial profile generation for irregular male polygon births,
  - angle deviation metadata (`maxDeviationDeg`) propagated to shape/inspector data.
- New tests:
  - contact-network known-edge selection,
  - view modifier alpha/fog helpers,
  - sleep system behavior,
  - irregular-birth cap/determinism assertions in reproduction tests.

### Changed
- Reproduction settings now include irregular-birth controls (`enabled`, base chance) and apply to reset/create-world flow.
- Regularization now refreshes and tracks angle-deviation metadata while converging irregular polygons.
- Movement/steering jitter reduced with tiny-angle deadbands and low-speed rotation guards.

## [0.7.2] - 2026-02-23

### Fixed
- GUI startup regression introduced in `0.7.1`:
  - fixed initialization-order crash (`Cannot access 'TIMELINE_TYPE_CONTROL_IDS' before initialization`) that prevented the app script from booting.
- Timeline UI is now fail-safe:
  - timeline renderer initializes only when timeline elements exist, so missing/partial DOM no longer hard-crashes the app.
- Sidebar panel collapse state is now storage-safe:
  - localStorage read/write failures (private mode / restricted storage) are caught and ignored instead of breaking startup.
- Added safe selector escaping fallback when `CSS.escape` is unavailable.
- Version injection hardened:
  - Vite now falls back to reading `package.json` version when `npm_package_version` is absent.

## [0.7.1] - 2026-02-23

### Added
- Event timeline analytics + renderer:
  - sparse, eventful-tick histogram (empty periods skipped)
  - filters by event type and rank/subclass tracks
  - focus filtering for selected entity involvement.
- `rankKey` helper (`src/core/rankKey.ts`) for consistent subclass-aware labeling in event analytics.
- Single-drain event fanout utility (`src/ui/eventDrainPipeline.ts`) with tests to guard against double-drain regressions.
- Build-time app version constant (`__APP_VERSION__`) exposed via `src/version.ts`.
- New tests for:
  - event drain pipeline behavior
  - rank key mapping
  - deterministic kill-counter increments
  - event analytics filtering
  - version constant.

### Changed
- Interaction overlays now use distinct, low-clutter glyphs by event type:
  - touch pulse, handshake pair mark, peace-cry ring, stab spark, death X, birth pulse, regularization plus.
- Core events now include rank-key metadata where relevant so timeline breakdown survives cleanup/death.
- Main loop now drains `world.events` once per tick and fans out the same event array to effects + analytics.
- Added focus-aware feeling overlays and optional hearing/talking overlays (off by default).
- Added toggleable stroke-by-kills rendering while preserving fill-by-rank.
- UI layout updated for responsive/mobile usage:
  - top app bar with hamburger + version badge
  - collapsible sidebar panels
  - improved stage/timeline layout on narrow screens.
- Event timeline panel added below the main world view with legend and tooltip support.
- App title and on-screen HUD now display the current package version automatically.

## [0.7.0] - 2026-02-23

### Added
- `socialNav` movement mode with deterministic BDI-lite intention updates (`roam`, `avoid`, `yield`, `approachMate`, `approachForFeeling`).
- `SocialNavMindSystem` and `SocialNavSteeringSystem` for smooth, low-flicker rank-aware motion.
- Genealogy and legacy tracking:
  - expanded lineage (`generation`, `dynastyId`, parents, birth tick)
  - per-entity legacy counters (births, deaths caused, handshakes, regularizations, living descendants)
  - ancestry helpers in `src/core/genealogy.ts`
- Durability + erosion model with deterministic wear and contact damage:
  - new `ErosionSystem`
  - lethality sharpness now reduced by wear-based blunting.
- Stability harness (`npm run stability`) in `src/tools/stabilityHarness.ts`.
- Additional tests:
  - social nav determinism/smooth heading bounds
  - erosion behavior
  - genealogy helpers
  - houses-disabled defaults.
- New root `AGENTS.md` with a Population Balance Contract and explicit stability bands.

### Changed
- Default spawn plan now starts with social-nav movement and a broader low-order distribution.
- Reproduction defaults retuned for better long-run balance (reduced conception pressure, tuned female birth share).
- Father-side reproduction modifiers now reduce male births and conception probability at higher male side counts.
- Inspector extended with:
  - social-nav state (current intention, ticks left, editable decision/intention windows)
  - lineage/legacy/durability details.
- Added harmonic motion preset wiring for smoother movement tuning.
- Main system order now includes social-nav systems and erosion before lethality cleanup.

### Removed
- Houses are hard-disabled by default in runtime world setup and default config.

## [0.6.0] - 2026-02-23

### Added
- Headless deterministic ECS-lite world expanded with:
  - south attraction field + south zone tuning
  - vision, hearing, feeling, stillness, peace-cry, intelligence, compensation, regularization, reproduction, and sway components/systems
- Solid collision resolution with deterministic manifold ordering.
- Event queue + visual effects layer for touch, handshake, peace-cry, stab, death, birth, and regularization highlights.
- Houses/worldgen (pentagonal default with constraints and deterministic placement).
- Flatlander 1D view strip rendering with raycast scan and fog controls.
- Camera pan/zoom and robust picking/controller path for stable inspector selection.
- Topology as world-level setting (`torus` or `bounded`) with global movement boundary synchronization.
- Population histogram panel and inspector kill counters.
- Extensive Vitest coverage for determinism, collision/lethality, fog/sight, hearing/mimicry, sway, houses, reproduction, and topology.

### Changed
- Lethality model updated to manifold-driven, vertex/endpoint-focused severity with pressure accumulation.
- South attraction tuned to be subtle by default and now clamped by `southEscapeFraction` so south remains dangerous but escapable.
- Sight recognition now fog-gated and skill-weighted; fog density `0` disables practical sight recognition.
- Avoidance steering now prioritizes sight and falls back to hearing deterministically.
- Reproduction now carries female status for female newborns.

### Fixed
- Picking/inspector reliability and camera coordinate conversion issues.
- Type-safety/narrowing issues under strict TypeScript + exact optional property rules.

### Infrastructure
- GitHub Pages artifact deployment workflow kept compatible with project-pages base path (`BASE_PATH`).
- Lint/test/build pass under strict TypeScript + Vitest + ESLint.
