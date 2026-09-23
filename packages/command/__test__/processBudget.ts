/**
 * Kill deadline for one spawned generated CLI. An unloaded test takes 1-2 s
 * because `tsx` transpiles the generated command tree on every start; with
 * the CPU oversubscribed threefold, the same tests took up to 6 s.
 */
export const GENERATED_CLI_PROCESS_TIMEOUT_MS = 30_000;

/**
 * Vitest timeout for a test that spawns processes; `vitest.config.ts` applies
 * it to `*.process` suites. It exceeds the kill deadline so a hung CLI fails
 * with the runner's error naming its arguments, not a generic test timeout.
 * Other tests keep the default timeout, so a hang there is still reported
 * within seconds.
 */
export const PROCESS_TEST_TIMEOUT_MS = 90_000;
