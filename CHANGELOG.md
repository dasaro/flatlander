# Changelog

All notable changes to this project are documented in this file.

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
