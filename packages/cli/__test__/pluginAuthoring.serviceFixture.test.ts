import { execFile } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const PROCESS_TEST_TIMEOUT_MS = 15_000;
const packageDirectory = path.resolve(import.meta.dirname, "..");
const repositoryDirectory = path.resolve(packageDirectory, "../..");
const cliEntry = path.join(packageDirectory, "dist", "entry.mjs");
const servicePluginExample = path.join(
  packageDirectory,
  "examples",
  "scoped-service-plugin.mjs"
);
const servicePluginTsconfig = path.join(
  packageDirectory,
  "examples",
  "tsconfig.json"
);
const requireFromRepository = createRequire(
  path.join(repositoryDirectory, "package.json")
);
const typescriptCli = requireFromRepository.resolve("typescript/lib/tsc.js");
const pluginAuthoringGuide = path.join(
  repositoryDirectory,
  "docs",
  "plugin-authoring.md"
);
const serviceFixtureOutputsDirectory = path.join(
  packageDirectory,
  "test",
  "outputs",
  "scoped-service-plugin"
);

const writeTinySpec = (workspace: string): string => {
  const specPath = path.join(workspace, "spec", "index.ts");
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
      "  },",
      "});",
      "",
    ].join("\n")
  );
  return specPath;
};

describe("documented scoped-service plugin", () => {
  const workspaces: string[] = [];

  afterEach(() => {
    for (const workspace of workspaces) {
      fs.rmSync(workspace, { recursive: true, force: true });
    }
    workspaces.length = 0;
  });

  test("keeps the guide aligned with the synchronous factory contract", () => {
    const guide = fs.readFileSync(pluginAuthoringGuide, "utf8");

    expect(guide).not.toContain("Effect.Effect<Plugin");
    expect(guide).toContain("scoped-service-plugin.mjs");
    expect(guide).toContain("exit-independent resources");
    expect(guide).toContain("Exit.void");
  });

  test(
    "typechecks the exact service-plugin example linked from the guide",
    async () => {
      await expect(
        execFileAsync(
          process.execPath,
          [typescriptCli, "--project", servicePluginTsconfig],
          {
            cwd: repositoryDirectory,
          }
        )
      ).resolves.toMatchObject({ stderr: "" });
    },
    PROCESS_TEST_TIMEOUT_MS
  );

  test(
    "acquires one resource and releases it after finalization through the built CLI",
    async () => {
      fs.mkdirSync(serviceFixtureOutputsDirectory, { recursive: true });
      const workspace = fs.mkdtempSync(
        path.join(serviceFixtureOutputsDirectory, "workspace-")
      );
      workspaces.push(workspace);

      const inputPath = writeTinySpec(workspace);
      const outputPath = path.join(workspace, "generated");
      const eventsPath = path.join(workspace, "resource-events.log");
      const configPath = path.join(workspace, "typeweaver.config.mjs");
      fs.writeFileSync(
        configPath,
        [
          "export default {",
          `  input: ${JSON.stringify(inputPath)},`,
          `  output: ${JSON.stringify(outputPath)},`,
          `  plugins: [[${JSON.stringify(servicePluginExample)}, {`,
          `    eventsPath: ${JSON.stringify(eventsPath)},`,
          "  }]],",
          "};",
          "",
        ].join("\n")
      );

      const result = await execFileAsync(
        process.execPath,
        [cliEntry, "generate", "--config", configPath, "--no-format"],
        {
          cwd: workspace,
        }
      );

      expect(result.stderr).toBe("");
      expect(result.stdout).toContain("Running on Node.js");
      expect(result.stdout).toContain("Successfully loaded 1 plugin(s)");
      expect(
        fs.readFileSync(
          path.join(outputPath, "scoped-service", "session.txt"),
          "utf8"
        )
      ).toBe("generated through a scoped service\n");
      expect(fs.readFileSync(eventsPath, "utf8").trim().split("\n")).toEqual([
        "acquire",
        "generate",
        "finalize",
        "release",
      ]);
    },
    PROCESS_TEST_TIMEOUT_MS
  );
});
