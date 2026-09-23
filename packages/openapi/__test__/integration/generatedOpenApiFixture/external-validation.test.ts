import { describe, test } from "vitest";
import { validateOpenApiFixture } from "./external-validator.js";
import { assertFixtureExists, FIXTURE_PATH } from "./fixtures.js";

describe("generated OpenAPI fixture validation", () => {
  test("passes the external OpenAPI validator", async () => {
    assertFixtureExists(FIXTURE_PATH);
    await validateOpenApiFixture(FIXTURE_PATH);
  }, 30_000);
});
