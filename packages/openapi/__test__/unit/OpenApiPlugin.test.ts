import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResponse,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { Effect } from "effect";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { openApiPlugin } from "../../src/index.js";
import {
  aNormalizedSpecWith,
  anInlineResponseUsage,
  anOperationWith,
  aResponseWith,
} from "./buildOpenApiDocument.helpers.js";
import type {
  OpenApiInfoObject,
  OpenApiServerObject,
} from "../../src/index.js";

type WrittenFile = {
  readonly path: string;
  readonly content: string;
};

type OpenApiGeneratorContext = GeneratorContext & {
  readonly writtenFiles: readonly WrittenFile[];
};

const runGenerate = (
  options: unknown,
  context: OpenApiGeneratorContext
): void => {
  const plugin = openApiPlugin(options);
  if (plugin.generate === undefined) {
    throw new Error("openApiPlugin must define a generate stage");
  }
  Effect.runSync(plugin.generate(context));
};

describe("openApiPlugin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("writes an OpenAPI document to the default output path", () => {
    const context = anOpenApiGeneratorContextWith(anItemsSpec());

    runGenerate({}, context);

    const document = JSON.parse(context.writtenFiles[0]?.content ?? "{}");
    expect(context.writtenFiles).toHaveLength(1);
    expect(context.writtenFiles[0]?.path).toBe("openapi/openapi.json");
    expect(document.openapi).toBe("3.1.1");
    expect(document.info).toEqual({
      title: "Typeweaver API",
      version: "0.0.0",
    });
    expect(document.paths).toHaveProperty("/items/{itemId}");
  });

  test("writes custom OpenAPI metadata to the configured output path", () => {
    const context = anOpenApiGeneratorContextWith(anItemsSpec());

    runGenerate(
      {
        info: { title: "Todo API", version: "1.0.0", summary: "Todos" },
        servers: [{ url: "https://api.example.com", description: "Production" }],
        outputPath: "docs/openapi.json",
      },
      context
    );

    const document = JSON.parse(context.writtenFiles[0]?.content ?? "{}");
    expect(context.writtenFiles[0]?.path).toBe("docs/openapi.json");
    expect(document.info).toEqual({
      title: "Todo API",
      version: "1.0.0",
      summary: "Todos",
    });
    expect(document.servers).toEqual([
      { url: "https://api.example.com", description: "Production" },
    ]);
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

  test("warns without embedding builder warnings in the OpenAPI document", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
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

    runGenerate({}, context);

    const document = JSON.parse(context.writtenFiles[0]?.content ?? "{}");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("OpenAPI generation completed with 1 warning(s).")
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("missing-path-parameter-schema")
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("Path parameter 'itemId' is missing a schema.")
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "/paths/~1items~1{itemId}/get/parameters/0/schema"
      )
    );
    expect(document).not.toHaveProperty("warnings");
  });

  test.each([
    {
      scenario: "null top-level config",
      options: null as never,
      message: /OpenApiPlugin config error: options must be an object/,
    },
    {
      scenario: "missing info version",
      options: { info: { title: "Todo API" } as OpenApiInfoObject },
      message: /info\.title and info\.version must be strings/,
    },
    {
      scenario: "non-array servers",
      options: {
        servers: {
          url: "https://api.example.com",
        } as unknown as readonly OpenApiServerObject[],
      },
      message: /servers must be an array/,
    },
    {
      scenario: "server without url",
      options: {
        servers: [{ description: "Production" } as OpenApiServerObject],
      },
      message: /servers\[0\]\.url must be a string/,
    },
    {
      scenario: "non-json output path",
      options: { outputPath: "openapi/openapi.yaml" },
      message: /outputPath must end with \.json/,
    },
    {
      scenario: "unsafe output path",
      options: { outputPath: "../openapi.json" },
      message: /outputPath must not contain parent directory segments/,
    },
  ])("rejects invalid config for $scenario", ({ options, message }) => {
    expect(() => openApiPlugin(options)).toThrow(message);
  });
});

function anItemsSpec(
  overrides: {
    readonly operations?: readonly NormalizedOperation[];
    readonly responses?: readonly NormalizedResponse[];
  } = {}
): NormalizedSpec {
  return aNormalizedSpecWith({
    resources: [
      {
        name: "Items",
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
    writtenFiles,
  };
}
