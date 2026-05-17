import fs from "node:fs";
import path from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../src/effectRuntime.js";
import { Generator } from "../src/services/Generator.js";

const tempDirs: string[] = [];

const createTempWorkspace = (suffix: string): string => {
  const tempDir = fs.mkdtempSync(
    path.join(process.cwd(), `.typeweaver-concurrent-${suffix}-`)
  );
  tempDirs.push(tempDir);
  return tempDir;
};

const writeTinySpec = (workspace: string, resourceName: string): string => {
  const specFile = path.join(workspace, "spec", "index.ts");
  const resourceCapitalized =
    resourceName.charAt(0).toUpperCase() + resourceName.slice(1);

  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
    [
      'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
      'import { z } from "zod";',
      "",
      `const ${resourceName}Loaded = defineResponse({`,
      `  name: "${resourceCapitalized}Loaded",`,
      "  statusCode: HttpStatusCode.OK,",
      `  description: "${resourceCapitalized} loaded",`,
      "  body: z.object({ id: z.string() }),",
      "});",
      "",
      "export const spec = defineSpec({",
      "  resources: {",
      `    ${resourceName}: {`,
      "      operations: [",
      "        defineOperation({",
      `          operationId: "get${resourceCapitalized}",`,
      `          path: "/${resourceName}s/:${resourceName}Id",`,
      "          method: HttpMethod.GET,",
      `          summary: "Get ${resourceName}",`,
      "          request: {",
      `            param: z.object({ ${resourceName}Id: z.string() }),`,
      "          },",
      `          responses: [${resourceName}Loaded],`,
      "        }),",
      "      ],",
      "    },",
      "  },",
      "});",
      "",
    ].join("\n")
  );

  return specFile;
};

describe("Generator.generate (concurrent invocations)", () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("two concurrent generations on disjoint workspaces each emit only their own entity", async () => {
    const workspaceA = createTempWorkspace("alpha");
    const workspaceB = createTempWorkspace("beta");
    writeTinySpec(workspaceA, "alpha");
    writeTinySpec(workspaceB, "beta");

    const callA = Effect.promise(() =>
      effectRuntime.runPromise(
        Generator.generate({
          inputFile: "spec/index.ts",
          outputDir: "generated/output",
          config: {
            input: "spec/index.ts",
            output: "generated/output",
            format: false,
          },
          currentWorkingDirectory: workspaceA,
        })
      )
    );

    const callB = Effect.promise(() =>
      effectRuntime.runPromise(
        Generator.generate({
          inputFile: "spec/index.ts",
          outputDir: "generated/output",
          config: {
            input: "spec/index.ts",
            output: "generated/output",
            format: false,
          },
          currentWorkingDirectory: workspaceB,
        })
      )
    );

    await Effect.runPromise(
      Effect.all([callA, callB], { concurrency: "unbounded" })
    );

    const outputA = path.join(workspaceA, "generated", "output");
    const outputB = path.join(workspaceB, "generated", "output");

    expect(
      fs.existsSync(path.join(outputA, "alpha", "GetAlphaRequest.ts"))
    ).toBe(true);
    expect(fs.existsSync(path.join(outputA, "beta"))).toBe(false);
    expect(fs.existsSync(path.join(outputB, "beta", "GetBetaRequest.ts"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(outputB, "alpha"))).toBe(false);

    const rootIndexA = fs.readFileSync(path.join(outputA, "index.ts"), "utf8");
    const rootIndexB = fs.readFileSync(path.join(outputB, "index.ts"), "utf8");

    expect(rootIndexA).toMatch(/alpha/);
    expect(rootIndexA).not.toMatch(/beta/);
    expect(rootIndexB).toMatch(/beta/);
    expect(rootIndexB).not.toMatch(/alpha/);
  });

  test("avoids PluginDependencyError when the shared runtime executes two generations concurrently", async () => {
    const workspaceA = createTempWorkspace("first");
    const workspaceB = createTempWorkspace("second");
    writeTinySpec(workspaceA, "alpha");
    writeTinySpec(workspaceB, "beta");

    const run = (workspace: string): Promise<void> =>
      effectRuntime.runPromise(
        Generator.generate({
          inputFile: "spec/index.ts",
          outputDir: "generated/output",
          config: {
            input: "spec/index.ts",
            output: "generated/output",
            format: false,
          },
          currentWorkingDirectory: workspace,
        })
      );

    await expect(
      Promise.all([run(workspaceA), run(workspaceB)])
    ).resolves.not.toThrow();
  });
});
