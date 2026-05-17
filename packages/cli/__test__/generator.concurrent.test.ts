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

const writeRecordingPlugin = (
  workspace: string,
  marker: string,
  otherMarker: string,
  sharedEventsFile: string
): string => {
  const pluginFile = path.join(workspace, "plugins", "interleave-recorder.mjs");
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import fs from "node:fs";',
      'import { Effect } from "effect";',
      "",
      `const eventsFile = ${JSON.stringify(sharedEventsFile)};`,
      `const marker = ${JSON.stringify(marker)};`,
      `const otherMarker = ${JSON.stringify(otherMarker)};`,
      "",
      // Barrier discipline: after each plugin records its event, it polls
      // the shared log until it sees at least one event from the other
      // fiber. This guarantees interleave deterministically — if only one
      // fiber were running, the wait would hang. Under serial execution,
      // the second fiber's first record would only land after the first
      // finished entirely, so the first would never observe `otherMarker`
      // events between its phases. The poll caps at 200 attempts at 5ms
      // each (1s total) so a genuinely broken concurrency model fails
      // fast rather than hanging the suite.",
      "const seenOtherMarker = () =>",
      "  fs.readFileSync(eventsFile, 'utf8').includes(otherMarker + ':');",
      "",
      "const waitForOther = Effect.gen(function* () {",
      "  for (let i = 0; i < 200; i++) {",
      "    if (seenOtherMarker()) return;",
      "    yield* Effect.sleep(5);",
      "  }",
      "});",
      "",
      "const record = stage =>",
      "  Effect.gen(function* () {",
      "    fs.appendFileSync(eventsFile, `${marker}:${stage}\\n`);",
      "    yield* waitForOther;",
      "  });",
      "",
      "export const interleaveRecorderPlugin = {",
      "  name: `interleave-recorder-${marker}`,",
      '  initialize: _ctx => record("initialize"),',
      "  collectResources: spec =>",
      "    Effect.gen(function* () {",
      '      yield* record("collectResources");',
      "      return spec;",
      "    }),",
      '  generate: _ctx => record("generate"),',
      '  finalize: _ctx => record("finalize"),',
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

describe("Generator.generate (concurrent invocations)", () => {
  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  test("produces disjoint outputs for parallel runs on isolated workspaces", async () => {
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

  test("avoids PluginDependencyError when the shared runtime executes two parallel generations", async () => {
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

  test("two concurrent generations with disjoint plugin sets each emit only their own plugin's files", async () => {
    // This is the registry-isolation regression: each generate call yields
    // a fresh PluginRegistry instance via `PluginRegistry.createInstance`. If
    // the registry were shared across calls, fiber B's plugin set would leak
    // into fiber A's pipeline (and vice versa), so the workspace configured
    // for `clients` would also emit Hono routers and the workspace
    // configured for `hono` would also emit HTTP clients.
    //
    // The concurrency claim is made discriminating by injecting a recording
    // plugin into each workspace that appends marker events to a shared log
    // at lifecycle boundaries (with a 1ms yield between phases). After both
    // fibers complete, the events list must interleave — under serial
    // execution every `A:*` event would precede every `B:*`, and the
    // interleave assertion would fail.
    const workspaceClients = createTempWorkspace("clients-only");
    const workspaceHono = createTempWorkspace("hono-only");
    writeTinySpec(workspaceClients, "alpha");
    writeTinySpec(workspaceHono, "alpha");

    const sharedEventsFile = path.join(
      workspaceClients,
      "..",
      `.typeweaver-concurrent-interleave-${process.pid}-${Date.now()}.log`
    );
    fs.writeFileSync(sharedEventsFile, "");

    const recorderA = writeRecordingPlugin(
      workspaceClients,
      "A",
      "B",
      sharedEventsFile
    );
    const recorderB = writeRecordingPlugin(
      workspaceHono,
      "B",
      "A",
      sharedEventsFile
    );

    const callClients = Effect.promise(() =>
      effectRuntime.runPromise(
        Generator.generate({
          inputFile: "spec/index.ts",
          outputDir: "generated/output",
          config: {
            input: "spec/index.ts",
            output: "generated/output",
            plugins: ["clients", recorderA],
            format: false,
          },
          currentWorkingDirectory: workspaceClients,
        })
      )
    );

    const callHono = Effect.promise(() =>
      effectRuntime.runPromise(
        Generator.generate({
          inputFile: "spec/index.ts",
          outputDir: "generated/output",
          config: {
            input: "spec/index.ts",
            output: "generated/output",
            plugins: ["hono", recorderB],
            format: false,
          },
          currentWorkingDirectory: workspaceHono,
        })
      )
    );

    try {
      await Effect.runPromise(
        Effect.all([callClients, callHono], { concurrency: "unbounded" })
      );

      const outputClients = path.join(workspaceClients, "generated", "output");
      const outputHono = path.join(workspaceHono, "generated", "output");

      expect(
        fs.existsSync(path.join(outputClients, "alpha", "AlphaClient.ts"))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(outputClients, "alpha", "AlphaHono.ts"))
      ).toBe(false);
      expect(
        fs.existsSync(path.join(outputHono, "alpha", "AlphaHono.ts"))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(outputHono, "alpha", "AlphaClient.ts"))
      ).toBe(false);

      // Discriminating concurrency check: not all `A:*` events may precede
      // every `B:*` event (or vice versa). Under serial execution the two
      // fibers would run back-to-back and every event from the first would
      // come before every event from the second — the assertion below
      // fails in that case. Under genuine concurrency the recorder
      // plugins coordinate via a shared-file barrier so each fiber waits
      // for the other's first event before continuing, guaranteeing
      // interleave for the rest of the lifecycle.
      const events = fs
        .readFileSync(sharedEventsFile, "utf8")
        .split("\n")
        .filter(line => line.length > 0);
      expect(events.length).toBeGreaterThan(2);

      const firstBIndex = events.findIndex(event => event.startsWith("B:"));
      const lastAIndex = events.reduce(
        (acc, event, idx) => (event.startsWith("A:") ? idx : acc),
        -1
      );
      // Concurrency proof: at least one A event appears AFTER B's first
      // event (i.e. lastA > firstB). If A ran to completion before B
      // started, lastA < firstB.
      expect(firstBIndex).toBeGreaterThanOrEqual(0);
      expect(lastAIndex).toBeGreaterThan(firstBIndex);
    } finally {
      fs.rmSync(sharedEventsFile, { force: true });
    }
  });
});
