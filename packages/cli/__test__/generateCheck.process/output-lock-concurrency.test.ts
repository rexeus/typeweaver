import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runCli } from "../helpers/builtCli.js";
import { writeTinySpec } from "../helpers/specFiles.js";
import {
  createWorkspace,
  generate,
  removeWorkspaces,
  writeConfig,
} from "./fixtures.js";
import type { ProcessResult } from "../helpers/builtCli.js";

const writeBlockingPlugin = (
  workspace: string,
  heldMarkerPath: string,
  releaseMarkerPath: string
): string => {
  const pluginPath = path.join(workspace, "plugins", "blocking-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import fs from "node:fs";',
      'import { Effect } from "effect";',
      "",
      `const heldMarkerPath = ${JSON.stringify(heldMarkerPath)};`,
      `const releaseMarkerPath = ${JSON.stringify(releaseMarkerPath)};`,
      "",
      // Yield to the runtime between polls instead of busy-waiting; the holder
      // stays blocked until the test writes the release marker.
      "const waitForRelease = Effect.gen(function* () {",
      "  while (!fs.existsSync(releaseMarkerPath)) {",
      "    yield* Effect.sleep(50);",
      "  }",
      "});",
      "",
      "export default {",
      '  name: "blocking-check-plugin",',
      "  initialize: () =>",
      "    Effect.sync(() => {",
      '      fs.writeFileSync(heldMarkerPath, "held\\n");',
      "    }),",
      "  generate: () => waitForRelease,",
      "};",
      "",
    ].join("\n")
  );
  return pluginPath;
};

const waitForFile = (filePath: string, timeoutMs: number): Promise<void> =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const poll = (): void => {
      if (fs.existsSync(filePath)) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error(`Timed out waiting for ${filePath}`));
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });

afterEach(removeWorkspaces);

describe("built CLI output lock concurrency", () => {
  test("a second generate process fails closed while one holds the lock", async () => {
    const workspace = createWorkspace();
    writeTinySpec(workspace);
    const heldMarkerPath = path.join(workspace, "lock-held.marker");
    const releaseMarkerPath = path.join(workspace, "lock-release.marker");
    const pluginPath = writeBlockingPlugin(
      workspace,
      heldMarkerPath,
      releaseMarkerPath
    );

    const holder = runCli(
      workspace,
      [
        "generate",
        "--input",
        "spec/index.ts",
        "--output",
        "generated",
        "--plugins",
        pluginPath,
        "--no-format",
      ],
      { timeoutMs: 45_000 }
    );
    let holderResult: ProcessResult | undefined;
    try {
      await waitForFile(heldMarkerPath, 20_000);

      // The contender deliberately omits the blocking plugin so a broken lock
      // cannot leave a second blocked process behind.
      const contender = await runCli(workspace, [
        "generate",
        "--input",
        "spec/index.ts",
        "--output",
        "generated",
        "--no-format",
      ]);

      expect(contender).toMatchObject({ code: 1, signal: null });
      expect(contender.stderr).toContain(
        "Another typeweaver generate is running"
      );
    } finally {
      fs.writeFileSync(releaseMarkerPath, "release\n");
      holderResult = await holder;
    }

    expect(holderResult).toMatchObject({ code: 0, signal: null });
  }, 60_000);
  test("check holding a missing mixed-case output blocks case-variant generation and creates neither", async () => {
    const workspace = createWorkspace();
    writeTinySpec(workspace);
    const configPath = writeConfig(workspace, [
      '  output: "./Generated/Output",',
    ]);
    const heldMarkerPath = path.join(workspace, "mixed-case-held.marker");
    const releaseMarkerPath = path.join(workspace, "mixed-case-release.marker");
    const pluginPath = writeBlockingPlugin(
      workspace,
      heldMarkerPath,
      releaseMarkerPath
    );
    const upperOutput = path.join(workspace, "Generated", "Output");
    const lowerOutput = path.join(workspace, "generated", "output");

    const holder = generate(
      workspace,
      ["--check", "--config", configPath, "--plugins", pluginPath],
      45_000
    );
    let holderResult: ProcessResult | undefined;
    try {
      await waitForFile(heldMarkerPath, 20_000);

      // The contender explicitly targets the lowercase spelling. Canonical lock
      // identity case-folds the whole path, so it must still collide.
      const contender = await generate(workspace, [
        "--input",
        "spec/index.ts",
        "--output",
        "generated/output",
        "--no-format",
      ]);

      expect(contender).toMatchObject({ code: 1, signal: null });
      expect(contender.stderr).toContain(
        "Another typeweaver generate is running"
      );
      expect(fs.existsSync(upperOutput)).toBe(false);
      expect(fs.existsSync(lowerOutput)).toBe(false);
    } finally {
      fs.writeFileSync(releaseMarkerPath, "release\n");
      holderResult = await holder;
    }

    // The check reports the missing output as drift without creating it.
    expect(holderResult).toMatchObject({ code: 1, signal: null });
    expect(fs.existsSync(upperOutput)).toBe(false);
    expect(fs.existsSync(lowerOutput)).toBe(false);
  }, 60_000);
});
