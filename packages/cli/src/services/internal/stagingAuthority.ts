import fs from "node:fs";
import { ReservedCoordinationPathError } from "../../errors/ReservedCoordinationPathError.js";
import { UnsafeStagingRootError } from "../../errors/UnsafeStagingRootError.js";
import {
  canonicalizePathForContainment,
  isSameOrDescendantOf,
} from "./canonicalPath.js";
import {
  assertPathNotReservedForCoordination,
  canonicalHostTempDirectory,
} from "./hostTemp.js";

export { assertPathNotReservedForCoordination } from "./hostTemp.js";

/**
 * Module-private token that makes a staging authority unforgeable. The symbol
 * is never exported, so only the CLI check pipeline can construct a value that
 * `assertGenerationOutputAllowed` accepts. Public programmatic callers of
 * `Generator.generate` therefore cannot bypass reserved-path guards.
 */
const STAGING_AUTHORITY_TOKEN = Symbol("typeweaver/staging-authority");

export type StagingAuthority = {
  readonly stageRoot: string;
  readonly token: typeof STAGING_AUTHORITY_TOKEN;
};

export const createStagingAuthority = (
  stageRoot: string
): StagingAuthority => ({
  stageRoot,
  token: STAGING_AUTHORITY_TOKEN,
});

export const isStagingAuthority = (
  value: unknown
): value is StagingAuthority => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as { token?: unknown; stageRoot?: unknown };
  return (
    candidate.token === STAGING_AUTHORITY_TOKEN &&
    typeof candidate.stageRoot === "string"
  );
};

const hostPathFs = {
  exists: (probePath: string): boolean => fs.existsSync(probePath),
  realPath: (probePath: string): string => fs.realpathSync.native(probePath),
};

/**
 * Rejects a generation output unless it is a configured output outside the
 * reserved coordination namespace or a path proven to descend from the exact
 * stage directory named by a valid staging authority. A forged or missing
 * authority is rejected rather than treated as internal.
 */
export const assertGenerationOutputAllowed = (params: {
  readonly outputDir: string;
  readonly stagingAuthority?: unknown;
}): void => {
  if (params.stagingAuthority === undefined) {
    assertPathNotReservedForCoordination(params.outputDir);
    return;
  }

  if (!isStagingAuthority(params.stagingAuthority)) {
    throw new ReservedCoordinationPathError({
      path: params.outputDir,
      tempRoot: canonicalHostTempDirectory(),
      reason: "untrusted-authority",
    });
  }

  const stageRoot = canonicalizePathForContainment(
    params.stagingAuthority.stageRoot,
    hostPathFs
  );
  const canonicalOutput = canonicalizePathForContainment(
    params.outputDir,
    hostPathFs
  );
  if (!isSameOrDescendantOf(canonicalOutput, stageRoot)) {
    throw new UnsafeStagingRootError({
      stagingRoot: stageRoot,
      reason: "not-descendant",
      conflictingPath: canonicalOutput,
    });
  }
};
