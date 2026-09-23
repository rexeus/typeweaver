import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../test-utils/src/test-project/output/openapi/openapi.json"
);

export type OpenApiFixture = {
  readonly openapi?: unknown;
  readonly components?: unknown;
  readonly paths?: unknown;
};

export function assertFixtureExists(fixturePath: string): void {
  if (!existsSync(fixturePath)) {
    throw new Error(
      `Missing generated OpenAPI fixture at ${fixturePath}. Run ` +
        "`pnpm --filter test-utils test:gen` to regenerate it."
    );
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
