# Tests

Unit and integration tests for the `@rexeus/typeweaver` CLI package.

## Running

```sh
pnpm test              # run once
pnpm exec vitest       # watch mode
```

## Structure

Every test file targets a single unit and is named after it:

- `foo.test.ts` exercises `src/foo.ts`
- `commandName.test.ts` exercises the `handleXCommand` in `src/commands/`
- `validate*.test.ts` cover the validate subsystem module-by-module
- `doctor*.test.ts` cover the doctor subsystem module-by-module
- `cli.test.ts` verifies commander wiring for every command

## Shared helpers

Import from `./__helpers__/`:

### `createTestLogger()`

Returns a `Logger` whose every channel is a fresh `vi.fn()` stub. Use it whenever a test might need
to assert on emitted messages — **including** tests that currently do not assert them. Staying on
one Logger factory keeps the suite consistent and makes future assertions cheap to add.

```ts
import { createTestLogger } from "./__helpers__/testLogger.js";

const logger = createTestLogger();
// later: expect(logger.error).toHaveBeenCalledWith("...")
```

### `createTempDirFactory(prefix, root?)`

Scoped temp-directory factory. Call once at the top of a `describe` block; the returned function
creates throwaway directories that are removed automatically in an auto-registered `afterEach`.

```ts
const createTempDir = createTempDirFactory("typeweaver-validate-");
```

Pass `root` when the temp dir **must** live inside the CLI package for `pnpm`-workspace module
resolution to find `@rexeus/typeweaver-core`. This applies to integration tests that bundle a real
spec:

```ts
const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const createTempDir = createTempDirFactory(".tmp-init-", PACKAGE_DIR);
```

## Conventions

- **Prefer integration tests at the command boundary.** Mock at module boundaries (e.g.
  `vi.mock("../src/generators/specLoader.js")`) rather than at deep internals.
- **Assert relative relationships, not magic numbers.** `totalChecks: 10` breaks silently when new
  checks arrive. `failedChecks: 1` + `skippedChecks: >= 1` survives refactors.
- **Descriptive test names.** A test name should describe the _observable behavior_ — avoid filler
  like "clearly" or "correctly". Prefer `"reports spec load failures as TW-SPEC-001 issues"` over
  `"surfaces errors nicely"`.
- **One reason per test.** If a test has more than ~5 distinct assertions across different concerns,
  split it so failures point directly to the broken invariant.
- **Keep temp dirs disposable.** Never rely on pre-existing state in the temp directory; always
  write your own fixture files before reading them.

## Adding new tests

1. Name the file after the unit under test.
2. Use `createTestLogger()` and `createTempDirFactory()` from `__helpers__/` — do not hand-roll
   stubs.
3. If the module has both pure functions and side-effectful integrations, split them into separate
   files (see `specGuards.test.ts` vs `specLoader.test.ts`).
4. If a check set, route set, or similar collection grows, add an _integrity guard_ test that
   asserts the set's self-consistency (see `validateChecks.test.ts` for the pattern).
