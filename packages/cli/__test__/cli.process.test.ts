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
const packageManifest: unknown = JSON.parse(
  fs.readFileSync(path.join(packageDirectory, "package.json"), "utf8")
);
if (
  typeof packageManifest !== "object" ||
  packageManifest === null ||
  !("version" in packageManifest) ||
  typeof packageManifest.version !== "string"
) {
  throw new Error("CLI package.json must declare a string version");
}
const packageVersion = packageManifest.version;
const processOutputsDirectory = path.join(
  packageDirectory,
  "test",
  "outputs",
  "cli-process"
);
const workspaces: string[] = [];

const runCli = (
  workspace: string,
  args: readonly string[]
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
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Built CLI process timed out: ${args.join(" ")}`));
    }, 15_000);
    child.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timeout);
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

const writeSpec = (
  workspace: string,
  options: { readonly duplicateOperationId?: boolean } = {}
): string => {
  const specPath = path.join(workspace, "spec", "index.ts");
  const duplicateResource = options.duplicateOperationId
    ? [
        "    duplicate: {",
        "      operations: [",
        "        defineOperation({",
        '          operationId: "ping",',
        '          path: "/duplicate",',
        "          method: HttpMethod.GET,",
        '          summary: "Duplicate ping",',
        "          request: {},",
        "          responses: [ok],",
        "        }),",
        "      ],",
        "    },",
      ]
    : [];

  fs.mkdirSync(path.dirname(specPath), { recursive: true });
  fs.writeFileSync(
    specPath,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      "",
      "const ok = defineResponse({",
      '  name: "Ok",',
      "  statusCode: HttpStatusCode.OK,",
      '  description: "OK",',
      "});",
      "",
      "export const spec = defineSpec({",
      '  metadata: { title: "Health API", version: "1.0.0" },',
      "  resources: {",
      "    health: {",
      "      operations: [",
      "        defineOperation({",
      '          operationId: "ping",',
      '          path: "/ping",',
      "          method: HttpMethod.GET,",
      '          summary: "Ping",',
      "          request: {},",
      "          responses: [ok],",
      "        }),",
      "      ],",
      "    },",
      ...duplicateResource,
      "  },",
      "});",
      "",
    ].join("\n")
  );
  return specPath;
};

const writeFormattingPlugin = (workspace: string): string => {
  const pluginPath = path.join(workspace, "plugins", "formatting-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import { Effect } from "effect";',
      "",
      "export default {",
      '  name: "process-formatting-plugin",',
      "  generate: context =>",
      "    Effect.sync(() => {",
      "      context.writeFile(",
      '        "plugin/Formatted.ts",',
      "        'export const formatted={name:\"plugin\",enabled:true};\\\\n'",
      "      );",
      "    }),",
      "};",
      "",
    ].join("\n")
  );
  return pluginPath;
};

const writeDefectPlugin = (workspace: string): string => {
  const pluginPath = path.join(workspace, "plugins", "defect-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import { Effect } from "effect";',
      "",
      "export default {",
      '  name: "process-defect-plugin",',
      "  generate: () => Effect.die(new Error('process plugin defect')),",
      "};",
      "",
    ].join("\n")
  );
  return pluginPath;
};

const writeFailingPlugin = (workspace: string): string => {
  const pluginPath = path.join(workspace, "plugins", "failing-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import { Effect } from "effect";',
      'import { PluginExecutionError } from "@rexeus/typeweaver-gen";',
      "",
      "export default {",
      '  name: "process-failing-plugin",',
      "  generate: () =>",
      "    Effect.fail(new PluginExecutionError({",
      '      pluginName: "process-failing-plugin",',
      '      phase: "generate",',
      '      cause: new Error("boom"),',
      "    })),",
      "};",
      "",
    ].join("\n")
  );
  return pluginPath;
};

const writeConfigProbePlugin = (workspace: string): string => {
  const pluginPath = path.join(workspace, "plugins", "config-probe-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });
  fs.writeFileSync(
    pluginPath,
    [
      'import { Effect } from "effect";',
      "",
      "export default {",
      '  name: "config-probe-plugin",',
      "  generate: context =>",
      "    Effect.sync(() => {",
      "      context.writeFile(",
      '        "plugin/custom-config.txt",',
      '        String(context.config.customFeature?.enabled) + "\\n"',
      "      );",
      "    }),",
      "};",
      "",
    ].join("\n")
  );
  return pluginPath;
};

const writeEmptySpec = (workspace: string): string => {
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
  return specPath;
};

afterEach(() => {
  for (const workspace of workspaces) {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
  workspaces.length = 0;
});

describe("built CLI generation process contract", () => {
  test("generates files and owns success output on stdout", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);

    const result = await runCli(workspace, [
      "generate",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--no-format",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain("Running on Node.js");
    expect(result.stdout).toContain("Starting generation...");
    expect(result.stdout).toContain("Generation complete!");
    expect(result.stdout).not.toContain("[DEBUG]");
    expect(result.stdout).not.toContain("FiberFailure");
    expect(fs.existsSync(path.join(workspace, "generated", "index.ts"))).toBe(
      true
    );
    expect(
      fs.existsSync(
        path.join(workspace, "generated", "health", "PingRequest.ts")
      )
    ).toBe(true);
    expect(
      fs.readFileSync(
        path.join(workspace, "generated", "responses", "OkResponse.ts"),
        "utf8"
      )
    ).toContain("export type IOkResponse");
  }, 15_000);
});

describe("built CLI configuration diagnostics", () => {
  test.each([
    {
      scenario: "input",
      args: ["generate", "--output", "generated", "--no-format"],
      message:
        "Missing required generate option 'input'. Pass --input or set 'input' in the TypeWeaver config file.",
    },
    {
      scenario: "output",
      args: ["generate", "--input", "spec/index.ts", "--no-format"],
      message:
        "Missing required generate option 'output'. Pass --output or set 'output' in the TypeWeaver config file.",
    },
  ])(
    "reports missing $scenario on stderr with exit code 1",
    async ({ args, message }) => {
      const workspace = createWorkspace();
      if (args.includes("spec/index.ts")) {
        writeSpec(workspace);
      }

      const result = await runCli(workspace, args);

      expect(result).toMatchObject({ code: 1, signal: null });
      expect(result.stdout).toBe("Running on Node.js\n");
      expect(result.stderr).toBe(`${message}\n`);
      expect(result.stderr).not.toContain("FiberFailure");
    },
    15_000
  );

  test("reports invalid imported configuration without a runtime stack", async () => {
    const workspace = createWorkspace();
    const inputPath = writeSpec(workspace);
    const configPath = path.join(workspace, "typeweaver.config.mjs");
    fs.writeFileSync(
      configPath,
      [
        "export default {",
        `  input: ${JSON.stringify(inputPath)},`,
        '  output: "./generated",',
        '  clean: "yes",',
        "};",
        "",
      ].join("\n")
    );

    const result = await runCli(workspace, [
      "generate",
      "--config",
      configPath,
      "--no-format",
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stdout).toBe("Running on Node.js\n");
    expect(result.stderr).toContain(
      `Configuration file '${configPath}' contains invalid values:`
    );
    expect(result.stderr).toContain('["clean"]');
    expect(result.stderr).not.toContain("FiberFailure");
    expect(result.stderr).not.toMatch(/\n\s+at /);
    expect(fs.existsSync(path.join(workspace, "generated"))).toBe(false);
  });
});

describe("built CLI custom configuration", () => {
  test("preserves custom config keys through runGenerate", async () => {
    const workspace = createWorkspace();
    const inputPath = writeSpec(workspace);
    const pluginPath = writeConfigProbePlugin(workspace);
    const outputPath = path.join(workspace, "generated");
    const configPath = path.join(workspace, "typeweaver.config.mjs");
    fs.writeFileSync(
      configPath,
      [
        "export default {",
        '  input: "./missing-from-config.ts",',
        '  output: "./wrong-output",',
        `  plugins: [${JSON.stringify(pluginPath)}],`,
        "  format: false,",
        "  customFeature: { enabled: true },",
        "};",
        "",
      ].join("\n")
    );

    const result = await runCli(workspace, [
      "generate",
      "--config",
      configPath,
      "--input",
      inputPath,
      "--output",
      outputPath,
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(
      fs.readFileSync(
        path.join(outputPath, "plugin", "custom-config.txt"),
        "utf8"
      )
    ).toBe("true\n");
    expect(fs.existsSync(path.join(workspace, "wrong-output"))).toBe(false);
  });
});

describe("built CLI informational commands", () => {
  test.each([
    {
      scenario: "duplicate operation ID",
      writeInvalidSpec: (workspace: string) =>
        writeSpec(workspace, { duplicateOperationId: true }),
      message: "Operation ID 'ping' must be globally unique within a spec.\n",
    },
    {
      scenario: "empty resources",
      writeInvalidSpec: writeEmptySpec,
      message: "Spec definition must contain at least one resource.\n",
    },
  ])(
    "reports $scenario domain validation on stderr",
    async ({ writeInvalidSpec, message }) => {
      const workspace = createWorkspace();
      writeInvalidSpec(workspace);

      const result = await runCli(workspace, [
        "generate",
        "--input",
        "spec/index.ts",
        "--output",
        "generated",
        "--no-format",
      ]);

      expect(result).toMatchObject({ code: 1, signal: null });
      expect(result.stdout).toContain("Running on Node.js");
      expect(result.stdout).toContain("Starting generation...");
      expect(result.stdout).not.toContain("Generation complete!");
      expect(result.stderr).toBe(message);
      expect(result.stderr).not.toContain("FiberFailure");
    }
  );
});

describe("built CLI plugin failure rendering", () => {
  test("renders a typed plugin failure once on stderr with exit code 1", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const pluginPath = writeFailingPlugin(workspace);

    const result = await runCli(workspace, [
      "generate",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      pluginPath,
      "--no-format",
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stdout).toContain("Running on Node.js");
    expect(result.stdout).not.toContain("Generation complete!");
    expect(result.stderr).toBe(
      "Plugin 'process-failing-plugin' failed during generate: boom\n"
    );
    expect(result.stderr).not.toContain("FiberFailure");
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });

  test("renders a plugin defect once on stderr with exit code 1", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);
    const pluginPath = writeDefectPlugin(workspace);

    const result = await runCli(workspace, [
      "generate",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      pluginPath,
      "--no-format",
    ]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stdout).toContain("Running on Node.js");
    expect(result.stdout).not.toContain("Generation complete!");
    expect(result.stderr).toBe("process plugin defect\n");
    expect(result.stderr).not.toContain("FiberFailure");
  });
});

describe("built CLI flag and verbosity handling", () => {
  test("gives negative flags precedence when conflicting flags are present", async () => {
    const workspace = createWorkspace();
    await expect(import("oxfmt")).resolves.toEqual(
      expect.objectContaining({ format: expect.any(Function) })
    );
    writeSpec(workspace);
    const pluginPath = writeFormattingPlugin(workspace);
    const outputPath = path.join(workspace, "generated");
    const sentinelPath = path.join(outputPath, "keep.txt");
    fs.mkdirSync(outputPath, { recursive: true });
    fs.writeFileSync(sentinelPath, "preserved\n");

    const result = await runCli(workspace, [
      "generate",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--plugins",
      pluginPath,
      "--format",
      "--no-format",
      "--clean",
      "--no-clean",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(fs.readFileSync(sentinelPath, "utf8")).toBe("preserved\n");
    expect(
      fs.readFileSync(path.join(outputPath, "plugin", "Formatted.ts"), "utf8")
    ).toBe('export const formatted={name:"plugin",enabled:true};\\n');
  });

  test("enables debug records only for the verbose runtime", async () => {
    const workspace = createWorkspace();
    writeSpec(workspace);

    const result = await runCli(workspace, [
      "generate",
      "--input",
      "spec/index.ts",
      "--output",
      "generated",
      "--no-format",
      "--verbose",
    ]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toContain("[DEBUG] Input file:");
    expect(result.stdout).toContain("[DEBUG] Acquired output lock");
    expect(result.stdout).toContain("[DEBUG] Released output lock");
  });

  test("reports the package version through Commander's historical -V alias", async () => {
    const workspace = createWorkspace();
    const result = await runCli(workspace, ["-V"]);

    expect(result).toMatchObject({ code: 0, signal: null, stderr: "" });
    expect(result.stdout).toBe(`Running on Node.js\n${packageVersion}\n\n`);
    expect(result.stdout).not.toContain("[DEBUG]");
  });
});

describe("built CLI parser diagnostics", () => {
  test("keeps parser validation diagnostics out of the custom error formatter", async () => {
    const workspace = createWorkspace();

    const result = await runCli(workspace, ["generate", "--unknown"]);

    expect(result).toMatchObject({ code: 1, signal: null });
    expect(result.stdout).toBe("Running on Node.js\n");
    expect(result.stderr).toBe("Received unknown argument: '--unknown'\n\n");
    expect(result.stderr).not.toContain("FiberFailure");
  });
});
