import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, test } from "vitest";
import {
  assertFixtureExists,
  validateOpenApiFixture,
} from "./generatedOpenApiFixture.validation.js";

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../test-utils/src/test-project/output/openapi/openapi.json"
);

describe("generated OpenAPI fixture validation", () => {
  test("passes the external OpenAPI validator", async () => {
    assertFixtureExists(FIXTURE_PATH);
    await validateOpenApiFixture(FIXTURE_PATH);
  }, 30_000);
});
