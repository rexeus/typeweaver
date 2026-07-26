import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResponse,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { withCapturedLogs } from "test-utils";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { openApiPlugin } from "../../src/index.js";
import {
  aNormalizedSpecWith,
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
} from "./buildOpenApiDocument.helpers.js";
import type {
  OpenApiPluginOptions,
  OpenApiServerObject,
} from "../../src/index.js";
import type { CapturedLog } from "test-utils";

type WrittenFile = {
  readonly path: string;
  readonly content: string;
};

type OpenApiGeneratorContext = GeneratorContext & {
  readonly writtenFiles: readonly WrittenFile[];
};

type CapturedPluginConfigError = {
  readonly _tag: "PluginConfigError";
  readonly pluginName: string;
  readonly reason: string;
  readonly message?: string;
};

const runGenerate = (
  options: unknown,
  context: OpenApiGeneratorContext
): void => {
  const plugin = openApiPlugin(options as OpenApiPluginOptions);
  if (plugin.generate === undefined) {
    throw new Error("openApiPlugin must define a generate stage");
  }
  Effect.runSync(plugin.generate(context));
};

const runGenerateCapturingLogs = (
  options: unknown,
  context: OpenApiGeneratorContext
): readonly CapturedLog[] => {
  const plugin = openApiPlugin(options as OpenApiPluginOptions);
  if (plugin.generate === undefined) {
    throw new Error("openApiPlugin must define a generate stage");
  }
  const { logs } = Effect.runSync(withCapturedLogs(plugin.generate(context)));
  return logs;
};

const captureOpenApiPluginConfigError = (
  options: unknown
): CapturedPluginConfigError => {
  try {
    openApiPlugin(options as OpenApiPluginOptions);
  } catch (error) {
    expect(error).toMatchObject({
      _tag: "PluginConfigError",
      pluginName: "openapi",
      reason: expect.any(String),
    });
    if (isCapturedPluginConfigError(error)) {
      return error;
    }
    throw new Error("Expected openApiPlugin to throw a PluginConfigError");
  }

  throw new Error("Expected openApiPlugin to reject invalid config");
};

const isCapturedPluginConfigError = (
  error: unknown
): error is CapturedPluginConfigError =>
  typeof error === "object" &&
  error !== null &&
  (error as { readonly _tag?: unknown })._tag === "PluginConfigError" &&
  (error as { readonly pluginName?: unknown }).pluginName === "openapi" &&
  typeof (error as { readonly reason?: unknown }).reason === "string";

describe("openApiPlugin output", () => {
  test("writes an OpenAPI document to the default output path", () => {
    const context = anOpenApiGeneratorContextWith(anItemsSpec());

    runGenerate({}, context);

    const document = JSON.parse(context.writtenFiles[0]?.content ?? "{}");
    expect(context.writtenFiles).toHaveLength(1);
    expect(context.writtenFiles[0]?.path).toBe("openapi/openapi.json");
    expect(document.openapi).toBe("3.1.2");
    expect(document.info).toEqual({
      title: "Todo API",
      version: "1.0.0",
    });
    expect(document.paths).toHaveProperty("/items/{itemId}");
  });

  test("projects spec metadata and the configured target and output path", () => {
    const context = anOpenApiGeneratorContextWith(
      anItemsSpec({
        metadata: {
          title: "Contract API",
          version: "2.0.0",
          description: "Contract description",
        },
      })
    );

    runGenerate(
      {
        target: "3.2.0",
        servers: [
          { url: "https://api.example.com", description: "Production" },
        ],
        outputPath: "docs/openapi.json",
      },
      context
    );

    const document = JSON.parse(context.writtenFiles[0]?.content ?? "{}");
    expect(context.writtenFiles[0]?.path).toBe("docs/openapi.json");
    expect(document.openapi).toBe("3.2.0");
    expect(document.info).toEqual({
      title: "Contract API",
      version: "2.0.0",
      description: "Contract description",
    });
    expect(document.servers).toEqual([
      { url: "https://api.example.com", description: "Production" },
    ]);
  });
});

describe("openApiPlugin diagnostics", () => {
  test("normalizes a safe backslash output path before writing", () => {
    const context = anOpenApiGeneratorContextWith(anItemsSpec());

    runGenerateCapturingLogs({ outputPath: "docs\\.\\openapi.json" }, context);

    expect(context.writtenFiles).toHaveLength(1);
    expect(context.writtenFiles[0]?.path).toBe("docs/openapi.json");
  });

  test("preserves server variables in configured OpenAPI servers", () => {
    const context = anOpenApiGeneratorContextWith(anItemsSpec());

    runGenerate(
      {
        servers: [
          {
            url: "https://{environment}.example.com/{basePath}",
            description: "Environment server",
            variables: {
              environment: {
                default: "api",
                enum: ["api", "staging"],
                description: "Deployment environment",
              },
              basePath: { default: "v1" },
            },
          },
        ],
      },
      context
    );

    const document = JSON.parse(context.writtenFiles[0]?.content ?? "{}");
    expect(document.servers).toEqual([
      {
        url: "https://{environment}.example.com/{basePath}",
        description: "Environment server",
        variables: {
          environment: {
            default: "api",
            enum: ["api", "staging"],
            description: "Deployment environment",
          },
          basePath: { default: "v1" },
        },
      },
    ]);
  });

  test("keeps validation issues out of generation logs and the document", () => {
    const context = anOpenApiGeneratorContextWith(
      anItemsSpec({
        operations: [
          anOperationWith({
            operationId: "getItem",
            path: "/items/:itemId",
            responses: [anInlineResponseUsage(aResponseWith())],
          }),
        ],
      })
    );

    const logs = runGenerateCapturingLogs({}, context);

    const document = JSON.parse(context.writtenFiles[0]?.content ?? "{}");
    const warningLogs = logs.filter(entry => entry.level === "WARN");
    expect(warningLogs).toEqual([]);
    expect(document).not.toHaveProperty("warnings");
  });
});

describe("openApiPlugin configuration errors", () => {
  test.each([
    {
      scenario: "null top-level config",
      options: null as never,
      reason: /options must be an object/,
    },
    {
      scenario: "unsupported target",
      options: { target: "3.1.1" as never },
      reason: /target must be '3\.1\.2' or '3\.2\.0'/,
    },
    {
      scenario: "non-array servers",
      options: {
        servers: {
          url: "https://api.example.com",
        } as unknown as readonly OpenApiServerObject[],
      },
      reason: /servers must be an array/,
    },
    {
      scenario: "server without url",
      options: {
        servers: [{ description: "Production" } as OpenApiServerObject],
      },
      reason: /servers\[0\]\.url must be a string/,
    },
    {
      scenario: "non-json output path",
      options: { outputPath: "openapi/openapi.yaml" },
      reason: /outputPath must end with \.json/,
    },
    {
      scenario: "empty output path",
      options: { outputPath: "" },
      reason: /outputPath must be a non-empty relative \.json path/,
    },
    {
      scenario: "non-string output path",
      options: { outputPath: 42 as never },
      reason: /outputPath must be a non-empty relative \.json path/,
    },
    {
      scenario: "null-byte output path",
      options: { outputPath: "openapi\0openapi.json" },
      reason: /outputPath must not contain null bytes/,
    },
    {
      scenario: "POSIX absolute output path",
      options: { outputPath: "/tmp/openapi.json" },
      reason: /outputPath must be relative/,
    },
    {
      scenario: "Windows absolute output path",
      options: { outputPath: "C:\\tmp\\openapi.json" },
      reason: /outputPath must be relative/,
    },
    {
      scenario: "unsafe output path",
      options: { outputPath: "../openapi.json" },
      reason: /outputPath must not contain parent directory segments/,
    },
  ])("rejects invalid config for $scenario", ({ options, reason }) => {
    const caught = captureOpenApiPluginConfigError(options);

    expect(caught.reason).toMatch(reason);
    expect(caught.message).toMatch(/^Plugin 'openapi' is misconfigured: /);
  });
});

function anItemsSpec(
  overrides: {
    readonly metadata?: NormalizedSpec["metadata"];
    readonly operations?: readonly NormalizedOperation[];
    readonly responses?: readonly NormalizedResponse[];
  } = {}
): NormalizedSpec {
  return aNormalizedSpecWith({
    ...(overrides.metadata === undefined
      ? {}
      : { metadata: overrides.metadata }),
    resources: [
      {
        name: "Items",
        tags: [],
        security: { requirements: [], source: "none" },
        operations: overrides.operations ?? [
          anOperationWith({
            operationId: "getItem",
            path: "/items/:itemId",
            summary: "Get item",
            request: { param: z.object({ itemId: z.string() }) },
            responses: [
              anInlineResponseUsage(
                aResponseWith({
                  name: "ItemLoaded",
                  description: "Item loaded",
                  body: z.object({ id: z.string(), name: z.string() }),
                })
              ),
            ],
          }),
        ],
      },
    ],
    responses: overrides.responses ?? [],
  });
}

function anOpenApiGeneratorContextWith(
  normalizedSpec: NormalizedSpec
): OpenApiGeneratorContext {
  const writtenFiles: WrittenFile[] = [];
  const notImplemented = (): never => {
    throw new Error("Not implemented by the openApiPlugin test context");
  };

  return {
    outputDir: "/tmp/typeweaver-openapi-test",
    inputDir: "/tmp/typeweaver-openapi-test/spec",
    config: {},
    normalizedSpec,
    coreDir: "@rexeus/typeweaver-core",
    responsesOutputDir: "/tmp/typeweaver-openapi-test/responses",
    specOutputDir: "/tmp/typeweaver-openapi-test/spec-out",
    getCanonicalResponse: notImplemented,
    getCanonicalResponseOutputFile: notImplemented,
    getCanonicalResponseImportPath: notImplemented,
    getSpecImportPath: notImplemented,
    getOperationDefinitionAccessor: notImplemented,
    getOperationOutputPaths: notImplemented,
    getResourceOutputDir: notImplemented,
    writeFile: (relativePath, content) => {
      writtenFiles.push({ path: relativePath, content });
    },
    renderTemplate: notImplemented,
    addGeneratedFile: notImplemented,
    getGeneratedFiles: () => writtenFiles.map(file => file.path),
    writeFileEffect: () =>
      Effect.die("Not implemented by the openApiPlugin test context"),
    renderTemplateEffect: () =>
      Effect.die("Not implemented by the openApiPlugin test context"),
    addGeneratedFileEffect: () =>
      Effect.die("Not implemented by the openApiPlugin test context"),
    writtenFiles,
  };
}
