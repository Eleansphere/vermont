# Vermont

A turn-based tactical battle game on a hex map (Rome vs. Carthage), shown in an isometric 3D view.

## Layout

| Path              | What it is                                                     | Must not                       |
| ----------------- | -------------------------------------------------------------- | ------------------------------ |
| `packages/core`   | Game state, rules and hex maths in plain TypeScript            | import Vue, Three.js, DOM APIs |
| `packages/render` | Three.js scene, camera and picking                             | import Vue or change the state |
| `apps/game`       | Vue 3 + Pinia application tying the core and renderer together | compute rules                  |

ESLint enforces the import boundaries (`eslint.config.mjs`).

## Getting started

Requires Node 24 and pnpm.

```bash
pnpm install
pnpm dev
```

## Scripts

| Script               | What it does                                 |
| -------------------- | -------------------------------------------- |
| `pnpm dev`           | Starts the game with Vite                    |
| `pnpm build`         | Builds the game into `apps/game/dist`        |
| `pnpm test`          | Runs all Vitest projects once                |
| `pnpm test:coverage` | Runs the tests with a coverage report        |
| `pnpm lint`          | Runs ESLint, including the import boundaries |
| `pnpm typecheck`     | Type-checks every package                    |
| `pnpm format`        | Formats the repository with Prettier         |

CI (`.github/workflows/ci.yml`) runs format check, lint, typecheck, tests and build.
