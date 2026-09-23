import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runCli } from "../helpers/builtCli.js";
import { writeEmptySpec } from "../helpers/specFiles.js";
import { createWorkspace, removeWorkspaces, writeSpec } from "./fixtures.js";

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

afterEach(removeWorkspaces);

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
  }, 15_000);
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
