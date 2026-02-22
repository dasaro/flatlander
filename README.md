# Flatlander

Flatlandia-inspired browser simulator built with TypeScript + Vite.

## MVP scope (0.1)
- Headless ECS-lite simulation core (world/components/systems)
- Deterministic seeded runs (same seed + spawn plan = same outcome)
- Fixed-timestep loop (30 ticks/sec), pause/resume/step/reset
- Shapes: segment (women), circle (priests), polygon (men regular + irregular)
- Rank classification at spawn time
- Spatial-hash broad phase + convex collision narrow phase
- Lethality rules based on vertex/endpoint stabbing
- Canvas renderer + plain DOM controls + inspector + stats
- Vitest unit tests for rank/geometry/collision/determinism

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
