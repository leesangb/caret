# pnpm Migration Design

## Goal

Migrate the repository from npm workspaces to pnpm workspaces without changing the package graph or build outputs.

## Scope

- Add `pnpm-workspace.yaml`
- Add root `packageManager` metadata
- Replace internal `file:../...` workspace dependencies with `workspace:*`
- Replace npm-oriented CI commands with pnpm equivalents
- Update user-facing install and task commands in README where they currently assume npm
- Regenerate the lockfile as `pnpm-lock.yaml`

## Non-Goals

- No `turbo` adoption
- No package publishing contract changes beyond workspace dependency notation
- No test or build pipeline redesign

## Approach

Use pnpm as the single package manager for local development and CI. Keep the existing root scripts so command names stay stable, but execute them through pnpm. Preserve the current workspace layout:

- `packages/*`
- `playground`

Internal workspace dependencies should use `workspace:*` so linking is explicit and package-manager-native.

## Files To Update

- Root [package.json](/Users/sblee/projects/caret/package.json:1)
- New [pnpm-workspace.yaml](/Users/sblee/projects/caret/pnpm-workspace.yaml:1)
- New `pnpm-lock.yaml`
- Remove `package-lock.json`
- Package manifests under `packages/*` and [playground/package.json](/Users/sblee/projects/caret/playground/package.json:1)
- CI workflow at [.github/workflows/ci.yml](/Users/sblee/projects/caret/.github/workflows/ci.yml:1)
- README command examples at [README.md](/Users/sblee/projects/caret/README.md:1)

## Validation

Run the repository with a clean pnpm install and verify:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:browser:vitest`
- `pnpm test:browser`
- `pnpm build`

## Risks

- CI can fail if any step still assumes `npm ci` or `package-lock.json`
- Workspace resolution can change if any package still relies on npm-specific linking behavior
- README examples can drift if install commands are not updated with the package manager switch

## Recommendation

Proceed with a direct cutover to pnpm in one branch. The repository is small enough that running both npm and pnpm in parallel would add more complexity than safety.
