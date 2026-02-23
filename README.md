# Flatlander

Flatlandia-inspired browser simulator built with TypeScript + Vite.

## Current scope (0.6)
- Headless ECS-lite deterministic simulation core (seeded + fixed timestep).
- Shapes/ranks: women segments, polygonal men (including irregular + regularization), priests as circles.
- Movement/perception: south attraction, vision, hearing, feeling, peace-cry, and avoidance steering.
- Interaction/combat: touch/handshake events, vertex-based lethality, solid collision resolution.
- Population dynamics: pregnancy/gestation/birth with lineage and fertility controls.
- Built environment: deterministic house generation and static obstacle interaction.
- Rendering/UI: Canvas world view, Flatlander strip view, pan/zoom, picking/inspector, event highlights, and population histogram.
- Tests: deterministic behavior, geometry/collision, topology, reproduction, houses, fog/sight, hearing/mimicry, and sway.

## Changelog
- See `CHANGELOG.md` for release history.

## Tech
- TypeScript
- Vite
- Canvas 2D
- Vitest
- ESLint + Prettier

## Scripts
- `npm run dev` - start local dev server
- `npm run build` - type-check and build `dist/`
- `npm run preview` - preview production build
- `npm test` - run unit tests
- `npm run lint` - lint TypeScript sources
- `npm run format` - format files

## Local development
1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`

## Determinism note
Reset rebuilds the world from:
- current seed
- full spawn plan history (including entities added via the Spawn panel)

## GitHub Pages deployment (GitHub Actions)
This repo is configured for **project pages** and uses the official Pages artifact workflow.

### Required repository setting
1. Open repository **Settings**.
2. Go to **Pages**.
3. Set **Source** to **GitHub Actions**.

### Workflow behavior
- Workflow file: `.github/workflows/deploy.yml`
- Triggers: `push` to `main` and `workflow_dispatch`
- Build uses:
  - `BASE_PATH="/${{ github.event.repository.name }}/"`
  - for this repo that resolves to `/flatlander/`
- Vite reads base from:
  - `process.env.BASE_PATH ?? "/"`
  - local dev uses `/`

## Project structure
- `src/core` - world state, seeded RNG, rank logic, factories, simulation loop
- `src/geometry` - convex polygon utilities, SAT/intersections, spatial hash
- `src/systems` - movement, collision, lethality, cleanup
- `src/render` - Canvas renderer
- `src/ui` - DOM controls/inspector/stats bindings
- `tests` - Vitest test suite
