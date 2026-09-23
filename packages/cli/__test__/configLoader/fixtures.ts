import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TypeweaverConfig } from "@rexeus/typeweaver-gen";
import { Effect, Result } from "effect";
import { ConfigLoader } from "../../src/services/ConfigLoader.js";

export const loadConfig = async (
  configPath: string
): Promise<Partial<TypeweaverConfig>> => {
  const result = await Effect.runPromise(
    Effect.result(ConfigLoader.load(configPath)).pipe(
      Effect.provide(ConfigLoader.Default)
    )
  );
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

const tempDirs: string[] = [];

export const removeTempDirs = (): void => {
  for (const tempDir of tempDirs) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  tempDirs.length = 0;
};

export const createTempDir = (): string => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "typeweaver-config-"));
  tempDirs.push(tempDir);

  return tempDir;
};

/** Writes `typeweaver.config<extension>` into a fresh ESM-scoped temp dir. */
export const writeConfigModule = (
  extension: string,
  contents: string
): string => {
  const tempDir = createTempDir();
  const configPath = path.join(tempDir, `typeweaver.config${extension}`);

  fs.writeFileSync(path.join(tempDir, "package.json"), '{"type":"module"}\n');

  fs.writeFileSync(configPath, `${contents.trim()}\n`);

  return configPath;
};
