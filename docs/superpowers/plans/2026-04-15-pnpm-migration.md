# pnpm Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the repository from npm workspaces to pnpm workspaces with workspace-native internal dependencies and CI that runs fully on pnpm.

**Architecture:** Keep the existing monorepo layout and root scripts, but make pnpm the single package manager for install, workspace linking, and CI execution. Replace npm-specific metadata and lockfiles, update internal package references to `workspace:*`, and switch CI and docs to pnpm commands so local development and automation use the same toolchain.

**Tech Stack:** pnpm workspaces, TypeScript, Vitest, Playwright, GitHub Actions, Vite

---

### Task 1: Convert Repository Metadata To pnpm

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json`
- Modify: `packages/dom/package.json`
- Modify: `packages/react/package.json`
- Modify: `playground/package.json`
- Delete: `package-lock.json`
- Create: `pnpm-lock.yaml`

- [ ] **Step 1: Update root package metadata for pnpm**

```json
{
  "packageManager": "pnpm@<installed-version>"
}
```

Keep the existing root scripts, but make sure they remain valid when invoked as `pnpm <script>`.

- [ ] **Step 2: Add pnpm workspace definition**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'playground'
```

- [ ] **Step 3: Switch internal workspace dependencies**

Update package manifests:

```json
{
  "dependencies": {
    "@caret/core": "workspace:*"
  }
}
```

```json
{
  "dependencies": {
    "@caret/dom": "workspace:*"
  }
}
```

```json
{
  "dependencies": {
    "@caret/react": "workspace:*"
  }
}
```

- [ ] **Step 4: Regenerate lockfile with pnpm**

Run:

```bash
pnpm install
```

Expected:
- `pnpm-lock.yaml` created
- `package-lock.json` removed from version control

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml packages/dom/package.json packages/react/package.json playground/package.json
git rm package-lock.json
git commit -m "chore: migrate workspace metadata to pnpm"
```

### Task 2: Update CI And Documentation To Use pnpm

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

- [ ] **Step 1: Update GitHub Actions install/setup flow**

Change workflow steps to pnpm-native setup:

```yaml
- uses: pnpm/action-setup@v4
  with:
    version: <same pnpm version as packageManager>

- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm

- run: pnpm install --frozen-lockfile
```

- [ ] **Step 2: Update CI commands**

Replace npm invocations with pnpm:

```yaml
- run: pnpm lint
- run: pnpm typecheck
- run: pnpm test
- run: pnpm build
- run: pnpm test:browser:vitest
- run: pnpm test:browser
```

- [ ] **Step 3: Update README command examples**

Replace install/task examples that currently use npm:

```bash
pnpm add @caret/dom
pnpm add @caret/react
pnpm capture:readme
```

Keep command intent identical; only swap the package-manager syntax.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "docs: switch workspace commands and CI to pnpm"
```

### Task 3: Verify pnpm Workflow End-To-End

**Files:**
- Verify only

- [ ] **Step 1: Run lint**

Run:

```bash
pnpm lint
```

Expected: exit code `0`

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exit code `0`

- [ ] **Step 3: Run unit and jsdom tests**

Run:

```bash
pnpm test
```

Expected: all Vitest suites pass

- [ ] **Step 4: Run browser-mode Vitest**

Run:

```bash
pnpm test:browser:vitest
```

Expected: browser-mode suites pass

- [ ] **Step 5: Run Playwright browser tests**

Run:

```bash
pnpm test:browser
```

Expected: all Playwright specs pass

- [ ] **Step 6: Run builds**

Run:

```bash
pnpm build
```

Expected: all workspace builds succeed

- [ ] **Step 7: Commit**

If verification required follow-up fixes:

```bash
git add <touched-files>
git commit -m "fix: align pnpm migration verification"
```

If no follow-up code changes were needed, skip this commit.

## Self-Review

**Spec coverage:** The plan covers workspace metadata, lockfile migration, internal dependency normalization, CI migration, README command updates, and full validation from the approved spec. No spec gaps found.

**Placeholder scan:** The only variable left is the exact installed pnpm version in `packageManager` and CI setup, which must be filled from the actual tool version during implementation.

**Type consistency:** Package names, workspace layout, and command names match the current repository structure and existing scripts.
