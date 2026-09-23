import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Cause, Exit } from "effect";
import { expect, vi } from "vitest";

export const causeDefects = (
  cause: Cause.Cause<unknown>
): ReadonlyArray<unknown> =>
  cause.reasons.filter(Cause.isDieReason).map(reason => reason.defect);

/** Roots removed after each test; tests may register extra paths. */
export const tempDirs: string[] = [];

export const restoreMocksAndRemoveRoots = (): void => {
  vi.restoreAllMocks();
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

export const makeRoot = (suffix: string): string => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), `typeweaver-comparison-${suffix}-`)
  );
  tempDirs.push(root);
  return root;
};

export const writeFile = (
  root: string,
  relativePath: string,
  content: string
): void => {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
};

export const extractTypedFailure = <E extends { readonly _tag: string }>(
  exit: Exit.Exit<unknown, E>
): E => {
  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isSuccess(exit)) {
    throw new Error("Expected effect to fail");
  }
  const failure = Cause.findErrorOption(exit.cause);
  if (failure._tag === "None") {
    throw new Error(`Expected typed failure: ${Cause.pretty(exit.cause)}`);
  }
  return failure.value;
};
