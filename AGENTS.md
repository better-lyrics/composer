# AGENTS.md

Operating notes for AI agents working in this repo.

## Toolchain

- Node 24 and pnpm 10, matching CI. Use `pnpm` only, never `npm` or `yarn`.
- React 19, Vite (through `vite-react-ssg`), TypeScript, Tailwind v4 (CSS theme in `src/index.css`, no
  config file), Zustand, Motion.
- Formatting and linting are Biome only.

## Verification gates

Run these before claiming work is done. CI runs the same checks:

```bash
pnpm typecheck        # tsc -b
pnpm test:unit        # Vitest, jsdom
pnpm test:component   # Vitest browser mode, Playwright Chromium
pnpm jscpd            # duplication check
pnpm lint:fix         # Biome lint + format; rewrites files in place
```

`pnpm test` runs both test projects. `pnpm knip` reports unused exports, dependencies and files: an
export with no importer is either dead or a duplicate of something that already exists.

Use the package scripts, not `pnpm exec vitest` or `npx vitest`. Run a failing suite once and read
the failure. Do not re-run it hoping for green.

## Testing

Composer is test-driven where it counts and test-light everywhere else. The suite exists to catch
the failures that hurt users: lost or corrupted projects, wrong TTML, broken sync, broken timeline
editing, broken undo, broken import and export. It does not exist to restate the implementation.

### Fewer tests by default

**Adding coverage is not part of "finishing" a change.** Ship the change, run the gates, and leave
the suite alone unless one of these is true:

- The maintainer asked for a test.
- You are fixing a bug whose cause was a non-obvious logic error. One test pins that exact
  regression, named `it("regression: ...")`.
- You are adding or changing logic on a core surface (persistence, history, TTML and lyrics parsing
  or writing, sync gestures, shared group timing, timeline geometry, word alignment) where the
  invariant cannot be confirmed by reading the function.

Never write a test for: presentational components, static pages, help or guide content, copy,
settings rows that only bind a store value, animations or visual polish, thin wrappers and
delegation, constants and config plumbing, anything `tsc` already proves, or an expected value you
got by running the code.

If you think something needs coverage and it does not clearly fit above, say what you would assert
and why in your summary, and let the maintainer decide. Do not write it speculatively.

### Test first when you do test

When a change qualifies for a test, write the test before the fix or the feature:

1. Write the test and run it. It must fail, and fail for the reason you expect, not because of a
   typo or a bad import.
2. Write the minimum code that makes it pass.
3. Run it again, then run the gates.

A bug fix starts from a reproduction. If the bug qualifies for a regression test, that test is the
reproduction. If it does not, reproduce it in the running app before you change
code. A fix for a bug nobody reproduced is a guess.

### How to write one

- Prefer a unit test (`*.test.ts`, jsdom) over a browser test. If the logic behind a component
  matters, move it into a pure function under `src/domain/` and unit test that.
- Browser tests (`*.browser.test.tsx`, colocated with the component) are slow and the main source of
  flakes. Use them only when a failure means a broken core user flow. One test per behaviour, never a
  matrix of cases.
- Extend the nearest existing test file before creating a new one. Prefer one assertion that states
  the invariant over a table of cases that enumerate the implementation.
- No mocks of project code. Use real parsers, real stores and real data. `fake-indexeddb` stands in
  for IndexedDB. Mock only outbound network calls to third-party services.
- Shared helpers live in `src/test/` (`render`, `stores`, `factories`, `frame-steps`, and others).
  Import `render` from `@/test/render`, never from `vitest-browser-react` directly.
- No fixed delays in browser tests. Wait with `expect.poll` or `expect.element`.

### Failing and flaky tests

A failing test is a signal. Never delete it, skip it, or change its assertion to match new behaviour
unless the behaviour changed on purpose and you can say why. Find the cause in production code first.

A flaky test on a core flow gets a root-cause fix. A flaky test on a non-core surface gets deleted,
after the maintainer agrees.

## Guard tests

The tests in `src/test/*.test.ts` are architecture guards. They scan the source and fail CI when a
rule is broken. If one fails, change your code to satisfy it. Do not weaken the guard or add your
file to its allowlist without the maintainer's approval.

- `no-inline-derivations`: line, word and instance concepts (timing bounds, "is synced", instance
  membership) are derived only by the modules in `src/domain/`. Call them, do not re-derive inline.
- `domain-isolation`: `src/domain/` never imports from stores, views, hooks, pages, ui or audio.
- `store-history-single-path`, `store-pending-snapshot`: undo history has one write path. A store
  write that skips history must mark the pending snapshot.
- `frame-loop-ownership`, `frame-loop-wiring-complete`: animation frames go through
  `src/lib/frame-loop.ts`, never raw `requestAnimationFrame`. A new store must be wired into the
  frame loop.
- `file-size-budget`: source files stay under 300 lines. Split the file instead of growing it.
- `one-concept-one-regex`: a regex literal is declared in one file only.
- `button-primitives`, `download-owner`, `pluralize-owner`, `no-raw-settings-references`: use the
  existing primitive (button components, download helper, `pluralize`, `SettingLink`) instead of a
  hand-rolled copy.

The rule behind all of them: every concept has one owner. Search for the existing implementation
before writing a new one.

## Code conventions

- Path aliases (`@/...`), named imports only, no barrel files.
- No `any`, `@ts-ignore` or `@ts-expect-error`.
- Comments are rare and explain why, never what. No commented-out code.
- No empty `catch` blocks. Log with context.
- Keyboard shortcuts are registered in `src/stores/shortcut-registry.ts` and stay remappable.
- No native `<select>` in app UI. Use `ui/select.tsx`.
- Never set `innerHTML`.
- No em dashes in code, copy or commit messages.
- Commit messages are one line: `type: brief description` (for example `fix: timing offset`).

## Pull requests

If an AI agent wrote or substantially wrote the change, say so in the PR description, naming the
model and the person it is acting for:

> Opened by `<model name>` working on behalf of `@<github-handle>`.

Both are placeholders. Fill in the model that actually wrote the change and the GitHub handle of the
person it is acting for. Keep the line even when the human reviews and amends the work.
