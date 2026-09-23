import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../src/effectRuntime.js";
import { GeneratedOutputChecker, Generator } from "../../src/services/index.js";
import { canonicalHostTempDirectory } from "../../src/services/internal/hostTemp.js";
import { writeTinySpec } from "../helpers/specFiles.js";
import {
  checkParams,
  createProjectWorkspace,
  createTempWorkspace,
  externalPaths,
  extractFailure,
  failureProperty,
  GENERATION_TEST_TIMEOUT_MS,
  removeTempPaths,
  runGenerate,
} from "./fixtures.js";

afterEach(removeTempPaths);

describe("GeneratedOutputChecker dependency parity", () => {
  test("mirrors ancestor lookup past a partial nearest node_modules", async () => {
    const workspace = createTempWorkspace("parity");
    const specTree = path.join(workspace, "packages", "spec-tree");
    const outputTree = path.join(workspace, "packages", "out-tree");
    // The output tree's nearest node_modules is empty; the required packages
    // only exist in the workspace-root node_modules one level higher. Normal
    // generation falls through, and the staged check must mirror that order.
    fs.mkdirSync(path.join(outputTree, "node_modules"), { recursive: true });
    writeTinySpec(specTree);

    const inputFile = "packages/spec-tree/spec/index.ts";
    const outputDir = "packages/out-tree/generated/output";
    const config = {
      input: inputFile,
      output: outputDir,
      format: false,
    } as const;

    await effectRuntime.runPromise(
      Generator.generate({
        inputFile,
        outputDir,
        config,
        currentWorkingDirectory: workspace,
      })
    );

    // The runtime import of `<output>/spec/spec.js` resolves the output
    // tree's node_modules. The staged check must mirror that and match.
    await expect(
      effectRuntime.runPromise(
        GeneratedOutputChecker.check({
          inputFile,
          outputDir,
          config,
          currentWorkingDirectory: workspace,
        })
      )
    ).resolves.toBeUndefined();
  });
});

describe("GeneratedOutputChecker shared-temp isolation", () => {
  test(
    "does not import a dependency available only above the shared stage root",
    async () => {
      const workspace = createProjectWorkspace("shared-temp-dependency");
      const packageName = `typeweaver-temp-probe-${String(process.pid)}-${Date.now().toString(36)}`;
      const plantedPackage = path.join(
        canonicalHostTempDirectory(),
        "node_modules",
        packageName
      );
      const sentinel = path.join(workspace, "executed.txt");
      externalPaths.push(plantedPackage);
      fs.mkdirSync(plantedPackage, { recursive: true });
      fs.writeFileSync(
        path.join(plantedPackage, "package.json"),
        JSON.stringify({
          name: packageName,
          type: "module",
          exports: "./index.js",
        })
      );
      fs.writeFileSync(
        path.join(plantedPackage, "index.js"),
        [
          'import fs from "node:fs";',
          `fs.writeFileSync(${JSON.stringify(sentinel)}, "executed\\n");`,
          "export const probe = true;",
          "",
        ].join("\n")
      );
      const specFile = writeTinySpec(workspace);
      const specSource = fs.readFileSync(specFile, "utf8");
      fs.writeFileSync(
        specFile,
        [
          `import { probe } from ${JSON.stringify(packageName)};`,
          'if (!probe) throw new Error("probe unavailable");',
          specSource,
        ].join("\n")
      );

      const exit = await effectRuntime.runPromiseExit(
        GeneratedOutputChecker.check(checkParams(workspace))
      );

      expect(failureProperty(extractFailure(exit), "_tag")).toBe(
        "SpecBundleError"
      );
      expect(fs.existsSync(sentinel)).toBe(false);
    },
    GENERATION_TEST_TIMEOUT_MS
  );
});

describe("GeneratedOutputChecker dynamic-import isolation", () => {
  test(
    "rejects unpinned dynamic imports before shared-temp resolution",
    async () => {
      const workspace = createProjectWorkspace("dynamic-temp-dependency");
      const packageName = `typeweaver-dynamic-temp-probe-${String(process.pid)}-${Date.now().toString(36)}`;
      const plantedPackage = path.join(
        canonicalHostTempDirectory(),
        "node_modules",
        packageName
      );
      const sentinel = path.join(workspace, "dynamic-executed.txt");
      externalPaths.push(plantedPackage);
      fs.mkdirSync(plantedPackage, { recursive: true });
      fs.writeFileSync(
        path.join(plantedPackage, "package.json"),
        JSON.stringify({
          name: packageName,
          type: "module",
          exports: "./index.js",
        })
      );
      fs.writeFileSync(
        path.join(plantedPackage, "index.js"),
        [
          'import fs from "node:fs";',
          `fs.writeFileSync(${JSON.stringify(sentinel)}, "executed\\n");`,
          "",
        ].join("\n")
      );
      const specFile = writeTinySpec(workspace);
      const specSource = fs.readFileSync(specFile, "utf8");
      fs.writeFileSync(
        specFile,
        [
          `const dynamicPackage = ${JSON.stringify(packageName)};`,
          "await import(dynamicPackage);",
          specSource,
        ].join("\n")
      );

      const exit = await effectRuntime.runPromiseExit(
        GeneratedOutputChecker.check(checkParams(workspace))
      );

      expect(failureProperty(extractFailure(exit), "_tag")).toBe(
        "SpecBundleError"
      );
      expect(fs.existsSync(sentinel)).toBe(false);
    },
    GENERATION_TEST_TIMEOUT_MS
  );
});

describe("GeneratedOutputChecker runtime resolution", () => {
  test(
    "resolves conditional exports with Node runtime conditions",
    async () => {
      const workspace = createProjectWorkspace("conditional-exports");
      const packageName = `typeweaver-conditions-${String(process.pid)}`;
      const packageDirectory = path.join(
        workspace,
        "node_modules",
        packageName
      );
      fs.mkdirSync(packageDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(packageDirectory, "package.json"),
        JSON.stringify({
          name: packageName,
          type: "module",
          exports: {
            ".": {
              node: "./node.js",
              browser: "./browser.js",
              default: "./default.js",
            },
          },
        })
      );
      fs.writeFileSync(
        path.join(packageDirectory, "node.js"),
        'export const operationId = "nodeOperation";\n'
      );
      fs.writeFileSync(
        path.join(packageDirectory, "browser.js"),
        'export const operationId = "browserOperation";\n'
      );
      fs.writeFileSync(
        path.join(packageDirectory, "default.js"),
        'export const operationId = "defaultOperation";\n'
      );
      const specFile = path.join(workspace, "spec", "index.ts");
      fs.mkdirSync(path.dirname(specFile), { recursive: true });
      fs.writeFileSync(
        specFile,
        [
          `import { operationId } from ${JSON.stringify(packageName)};`,
          'import { defineOperation, defineResponse, defineSpec, HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";',
          'const ok = defineResponse({ name: "Ok", statusCode: HttpStatusCode.OK, description: "OK" });',
          'export const spec = defineSpec({ metadata: { title: "Conditions", version: "1.0.0" }, resources: { probe: { operations: [defineOperation({ operationId, path: "/probe", method: HttpMethod.GET, summary: "Probe", request: {}, responses: [ok] })] } } });',
          "",
        ].join("\n")
      );

      await runGenerate(workspace);
      await expect(
        effectRuntime.runPromise(
          GeneratedOutputChecker.check(checkParams(workspace))
        )
      ).resolves.toBeUndefined();
    },
    GENERATION_TEST_TIMEOUT_MS
  );
});
