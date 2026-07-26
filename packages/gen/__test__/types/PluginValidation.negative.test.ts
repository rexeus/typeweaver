import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/bin/tsc6");
const invalidFixture = fileURLToPath(
  new URL(
    "../../fixtures/plugin-validation-context.invalid.ts",
    import.meta.url
  )
);

describe("PluginValidationContext negative contract", () => {
  test("rejects write-capable validation hooks for the expected reason", () => {
    const result = spawnSync(
      process.execPath,
      [
        tscPath,
        "--ignoreConfig",
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--module",
        "NodeNext",
        "--moduleResolution",
        "NodeNext",
        "--target",
        "ESNext",
        "--pretty",
        "false",
        invalidFixture,
      ],
      { encoding: "utf8" }
    );

    const diagnostics = `${result.stdout}\n${result.stderr}`;
    expect(result.status).not.toBe(0);
    expect(diagnostics).toContain(
      "Property 'writeFile' does not exist on type 'PluginValidationContext'"
    );
  }, 15_000);
});
