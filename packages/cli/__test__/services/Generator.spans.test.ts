import fs from "node:fs";
import path from "node:path";
import { Effect, Tracer } from "effect";
import { afterEach, describe, expect, test } from "vitest";
import { effectRuntime } from "../../src/effectRuntime.js";
import { Generator } from "../../src/services/Generator.js";

type CapturedSpan = {
  readonly name: string;
  readonly parentName: string | undefined;
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
        attributes: new Map(),
        links,
        sampled: true,
        kind,
        end: () => undefined,
        attribute: () => undefined,
        event: () => undefined,
        addLinks: () => undefined,
      };
      spans.set(spanId, span);
      recorded.push({ name, parentName });
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

  test("emits the top-level 'typeweaver.generate' span when generating a spec", async () => {
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

    expect(spans.some(s => s.name === "typeweaver.generate")).toBe(true);
  });

  /**
   * Characterization: the generator currently emits only the top-level
   * `typeweaver.generate` span — no nested phase spans. This locks the
   * current behavior so that any future PR adding nested spans
   * (e.g. `typeweaver.generate.bundle`, `typeweaver.generate.plugins`) must
   * intentionally update this expectation. Until then, observability of
   * sub-phase timing depends on log messages alone.
   */
  test("currently emits only the top-level span and no children (characterization)", async () => {
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

    const childSpans = spans.filter(
      s => s.parentName === "typeweaver.generate"
    );
    expect(childSpans).toEqual([]);
  });
});
