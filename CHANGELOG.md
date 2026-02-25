# Changelog

All notable changes to this project are documented in this file.

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
