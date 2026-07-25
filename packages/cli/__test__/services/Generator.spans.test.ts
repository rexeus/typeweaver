import fs from "node:fs";
import path from "node:path";
import { Effect, Tracer } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../src/effectRuntime.js";
import { Generator } from "../../src/services/Generator.js";

type CapturedSpan = {
  readonly name: string;
  readonly parentName: string | undefined;
  readonly attributes: ReadonlyMap<string, unknown>;
};

/**
 * Builds a `Tracer` that records every span name (and its parent's name)
 * into the supplied array. Anything other than name/parent is left as
 * stub behavior — the smoke test only inspects the span topology.
 */
const makeCapturingTracer = (recorded: CapturedSpan[]): Tracer.Tracer => {
  const spans = new Map<string, Tracer.Span>();
  return Tracer.make({
    span: (name, parent, context, links, startTime, kind) => {
      const spanId = String(spans.size + 1);
      const attributes = new Map<string, unknown>();
      const parentName =
        parent._tag === "Some" && parent.value._tag === "Span"
          ? (spans.get(parent.value.spanId)?.name ?? undefined)
          : undefined;
      const span: Tracer.Span = {
        _tag: "Span",
        name,
        spanId,
        traceId: "trace-1",
        parent,
        context,
        status: { _tag: "Started", startTime },
        attributes,
        links,
        sampled: true,
        kind,
        end: () => undefined,
        attribute: (key, value) => {
          attributes.set(key, value);
        },
        event: () => undefined,
        addLinks: () => undefined,
      };
      spans.set(spanId, span);
      recorded.push({ name, parentName, attributes });
      return span;
    },
    context: (f, _fiber) => f(),
  });
};

const writeTinySpec = (workspace: string): string => {
  const specFile = path.join(workspace, "spec", "index.ts");
  fs.mkdirSync(path.dirname(specFile), { recursive: true });
  fs.writeFileSync(
    specFile,
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
  return specFile;
};

const writeObservablePlugin = (workspace: string): string => {
  const pluginFile = path.join(workspace, "plugins", "observable-plugin.mjs");
  fs.mkdirSync(path.dirname(pluginFile), { recursive: true });
  fs.writeFileSync(
    pluginFile,
    [
      'import { Effect } from "effect";',
      "",
      "export const observablePlugin = {",
      '  name: "observable",',
      "  initialize: () => Effect.void,",
      "  collectResources: normalizedSpec => Effect.succeed(normalizedSpec),",
      "  generate: () => Effect.void,",
      "  finalize: () => Effect.void,",
      "};",
      "",
    ].join("\n")
  );
  return pluginFile;
};

const expectSpanHierarchy = (
  spans: readonly CapturedSpan[],
  params: {
    readonly name: string;
    readonly parentName: string | undefined;
    readonly plugin?: string;
    readonly occurrences?: number;
  }
): void => {
  const named = spans.filter(
    span =>
      span.name === params.name &&
      (params.plugin === undefined ||
        span.attributes.get("plugin") === params.plugin)
  );
  const matching = named.filter(span => span.parentName === params.parentName);
  const expectedOccurrences = params.occurrences ?? named.length;
  expect(
    named,
    `${params.name} should occur exactly ${expectedOccurrences} time(s)${
      params.plugin === undefined ? "" : ` for plugin ${params.plugin}`
    }`
  ).toHaveLength(expectedOccurrences);
  expect(
    matching,
    `${params.name} should be parented by ${params.parentName}${
      params.plugin === undefined ? "" : ` for plugin ${params.plugin}`
    }; captured spans: ${JSON.stringify(
      spans.map(span => ({
        name: span.name,
        parentName: span.parentName,
        plugin: span.attributes.get("plugin"),
      }))
    )}`
  ).toHaveLength(expectedOccurrences);
  expect(named.length).toBeGreaterThan(0);
};

describe("Generator span emission", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const tempDir of tempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  const createTempWorkspace = (): string => {
    const tempDir = fs.mkdtempSync(
      path.join(process.cwd(), ".typeweaver-spans-")
    );
    tempDirs.push(tempDir);
    return tempDir;
  };

  test("emits the top-level 'typeweaver.Generator.generate' span when generating a spec", async () => {
    const workspace = createTempWorkspace();
    const inputFile = writeTinySpec(workspace);
    const outputDir = path.join(workspace, "generated");
    const spans: CapturedSpan[] = [];

    await effectRuntime.runPromise(
      Generator.generate({
        inputFile,
        outputDir,
        currentWorkingDirectory: workspace,
        config: { input: inputFile, output: outputDir, format: false },
      }).pipe(Effect.withTracer(makeCapturingTracer(spans)))
    );

    expectSpanHierarchy(spans, {
      name: "typeweaver.Generator.generate",
      parentName: undefined,
      occurrences: 1,
    });
  });

  test("nests pipeline and plugin-phase spans under 'typeweaver.Generator.generate'", async () => {
    const workspace = createTempWorkspace();
    const inputFile = writeTinySpec(workspace);
    const pluginFile = writeObservablePlugin(workspace);
    const outputDir = path.join(workspace, "generated");
    const spans: CapturedSpan[] = [];

    await effectRuntime.runPromise(
      Generator.generate({
        inputFile,
        outputDir,
        currentWorkingDirectory: workspace,
        config: {
          input: inputFile,
          output: outputDir,
          format: false,
          plugins: [pluginFile],
        },
      }).pipe(Effect.withTracer(makeCapturingTracer(spans)))
    );

    const generatorSpan = "typeweaver.Generator.generate";
    expectSpanHierarchy(spans, {
      name: generatorSpan,
      parentName: undefined,
      occurrences: 1,
    });
    expectSpanHierarchy(spans, {
      name: "typeweaver.PluginLoader.loadAll",
      parentName: generatorSpan,
      occurrences: 1,
    });
    expectSpanHierarchy(spans, {
      name: "typeweaver.SpecLoader.load",
      parentName: generatorSpan,
      occurrences: 1,
    });
    expectSpanHierarchy(spans, {
      name: "typeweaver.IndexFileGenerator.generate",
      parentName: generatorSpan,
      occurrences: 1,
    });
    expectSpanHierarchy(spans, {
      name: "typeweaver.SpecBundler.bundle",
      parentName: "typeweaver.SpecLoader.load",
      occurrences: 1,
    });
    expectSpanHierarchy(spans, {
      name: "typeweaver.SpecImporter.importDefinition",
      parentName: "typeweaver.SpecLoader.load",
      occurrences: 1,
    });
    expectSpanHierarchy(spans, {
      name: "typeweaver.PluginModuleLoader.load",
      parentName: "typeweaver.PluginLoader.loadAll",
    });
    expectSpanHierarchy(spans, {
      name: "typeweaver.Generator.finalizePlugins",
      parentName: generatorSpan,
      occurrences: 1,
    });

    for (const phase of ["initialize", "collectResources", "generate"]) {
      expectSpanHierarchy(spans, {
        name: `typeweaver.plugin.${phase}`,
        parentName: generatorSpan,
        plugin: "observable",
        occurrences: 1,
      });
    }
    expectSpanHierarchy(spans, {
      name: "typeweaver.plugin.finalize",
      parentName: "typeweaver.Generator.finalizePlugins",
      plugin: "observable",
      occurrences: 1,
    });
  });
});
