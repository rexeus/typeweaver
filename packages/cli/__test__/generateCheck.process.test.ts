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

const packageDirectory = path.resolve(import.meta.dirname, "..");

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

const writeEmptySpec = (workspace: string): void => {
  const specPath = path.join(workspace, "spec", "index.ts");
  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(
    specPath,
    [
      'import { defineSpec } from "@rexeus/typeweaver-core";',
      "",
      'export const spec = defineSpec({ metadata: { title: "Empty API", version: "1.0.0" }, resources: {} });',
      "",
    ].join("\n")
  );
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

const snapshotTree = (root: string): Record<string, string> => {
  const snapshot: Record<string, string> = {};
  if (!fs.existsSync(root)) {
    return snapshot;
  }
  const pending = [""];
  while (pending.length > 0) {
    const relativeDirectory = pending.pop() ?? "";
    const absoluteDirectory = path.join(root, relativeDirectory);
    for (const entry of fs.readdirSync(absoluteDirectory, {
      withFileTypes: true,
    })) {
      const relativePath =
        relativeDirectory === ""
          ? entry.name
          : `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        pending.push(relativePath);
      } else {
        snapshot[relativePath] = fs
          .readFileSync(path.join(root, relativePath))
          .toString("base64");
      }
    }
  }
  return snapshot;
};

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

describe("built CLI generate --check matches", () => {
  test("matches committed output and leaves it untouched with explicit flags", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);

    const generation = await generate(workspace, [
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--no-format",
    ]);
    expect(generation.code).toBe(0);
    const before = snapshotTree(path.join(workspace, "generated"));

    const result = await generate(workspace, [
      "--check",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--no-format",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain("is current");
    expect(snapshotTree(path.join(workspace, "generated"))).toEqual(before);
    expect(
      fs.existsSync(path.join(workspace, "generated", ".typeweaver-lock"))
    ).toBe(false);
  }, 30_000);
  test("matches committed output through the config workflow", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const configPath = writeConfig(workspace);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain("is current");
  }, 15_000);
});

describe("built CLI generate --check drift", () => {
  test("reports Added, Removed, and Changed groups and leaves output untouched", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const configPath = writeConfig(workspace);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);

    const outputDir = path.join(workspace, "generated");
    fs.writeFileSync(
      path.join(outputDir, "item", "GetItemRequest.ts"),
      "// mutated committed output\n"
    );
    fs.rmSync(path.join(outputDir, "index.ts"), { force: true });
    fs.writeFileSync(path.join(outputDir, "planted.ts"), "// planted\n");
    const before = snapshotTree(outputDir);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stderr).toContain("Added");
    expect(result.stderr).toContain("index.ts");
    expect(result.stderr).toContain("Removed");
    expect(result.stderr).toContain("planted.ts");
    expect(result.stderr).toContain("Changed");
    expect(result.stderr).toContain("item/GetItemRequest.ts");
    expect(snapshotTree(outputDir)).toEqual(before);
  }, 15_000);
  test("reports a missing configured output as added drift without creating it", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const configPath = writeConfig(workspace);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stderr).toContain("Added");
    expect(fs.existsSync(path.join(workspace, "generated"))).toBe(false);
  }, 15_000);
});

describe("built CLI generate --check clean:false", () => {
  test("snapshots the committed output before comparison", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const configPath = writeConfig(workspace, ["  clean: false,"]);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);
    const sentinelPath = path.join(workspace, "generated", "keep.txt");
    fs.writeFileSync(sentinelPath, "preserved by no-clean\n");

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(fs.readFileSync(sentinelPath, "utf8")).toBe(
      "preserved by no-clean\n"
    );
  }, 15_000);
});

describe("built CLI generate --check generation failure", () => {
  test("fails without mutating configured output", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const configPath = writeConfig(workspace);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);
    const before = snapshotTree(path.join(workspace, "generated"));
    writeEmptySpec(workspace);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stderr).toContain("at least one resource");
    expect(snapshotTree(path.join(workspace, "generated"))).toEqual(before);
  }, 15_000);
});

describe("built CLI generate --check verbose", () => {
  test("keeps debug lock lifecycle output while matching", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const configPath = writeConfig(workspace);

    const generation = await generate(workspace, ["--config", configPath]);
    expect(generation.code).toBe(0);

    const result = await generate(workspace, [
      "--check",
      "--config",
      configPath,
      "--verbose",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain("[DEBUG] Acquired output lock");
    expect(result.stdout).toContain("[DEBUG] Released output lock");
    expect(result.stdout).toContain("is current");
  }, 15_000);
});
