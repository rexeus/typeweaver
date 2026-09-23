import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { ChildProcess } from "node:child_process";

type ProcessResult = {
  readonly code: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
};

const packageDirectory = path.resolve(import.meta.dirname, "..", "..");

const cliEntry = path.join(packageDirectory, "bin", "typeweaver.mjs");

const processOutputsDirectory = path.join(
  packageDirectory,
  "test",
  "outputs",
  "generate-check"
);

const workspaces: string[] = [];

const runCli = (
  workspace: string,
  args: readonly string[],
  timeoutMs = 15_000
): Promise<ProcessResult> =>
  new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(process.execPath, [cliEntry, ...args], {
      cwd: workspace,
      env: {
        ...process.env,
        FORCE_COLOR: "0",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", chunk => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", chunk => {
      stderr += String(chunk);
    });
    let timeoutError: Error | undefined;
    const timeout = setTimeout(() => {
      timeoutError = new Error(
        `Built CLI process timed out: ${args.join(" ")}`
      );
      child.kill("SIGKILL");
    }, timeoutMs);
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
      if (timeoutError !== undefined) {
        reject(timeoutError);
        return;
      }
      resolve({
        code,
        signal,
        stdout: stdout.replace(/\r\n/g, "\n"),
        stderr: stderr.replace(/\r\n/g, "\n"),
      });
    });
  });

const createWorkspace = (): string => {
  fs.mkdirSync(processOutputsDirectory, { recursive: true });
  const workspace = fs.mkdtempSync(
    path.join(processOutputsDirectory, "workspace-")
  );
  workspaces.push(workspace);
  return workspace;
};

const writeSpec = (workspace: string): string => {
  const specPath = path.join(workspace, "spec", "index.ts");
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(
    specPath,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      'import { z } from "zod";',
      "",
      "const itemLoaded = defineResponse({",
      '  name: "ItemLoaded",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "Item loaded",',
      "  body: z.object({ id: z.string() }),",
      "});",
      "",
      "export const spec = defineSpec({",
      '  metadata: { title: "Items API", version: "1.0.0" },',
      "  resources: {",
      "    item: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "getItem",',
      '          path: "/items/:itemId",',
      "          method: HttpMethod.GET,",
      '          summary: "Get item",',
      "          request: { param: z.object({ itemId: z.string() }) },",
      "          responses: [itemLoaded],",
      "        }),",
      "      ],",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n")
  );
  return specPath;
};

const writeConfig = (
  workspace: string,
  overrides: readonly string[] = []
): string => {
  const configPath = path.join(workspace, "typeweaver.config.mjs");
  fs.writeFileSync(
    configPath,
    [
      "export default {",
      '  input: "./spec/index.ts",',
      '  output: "./generated",',
      "  format: false,",
      ...overrides,
      "};",
      "",
    ].join("\n")
  );
  return configPath;
};

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

const generate = (
  workspace: string,
  args: readonly string[],
  timeoutMs = 15_000
) => runCli(workspace, ["generate", ...args], timeoutMs);

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
});

describe("built CLI output lock concurrency", () => {
  test("a second generate process fails closed while one holds the lock", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
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
      45_000
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
    writeSpec(workspace);
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
