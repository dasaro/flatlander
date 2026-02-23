# Changelog

All notable changes to this project are documented in this file.

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
