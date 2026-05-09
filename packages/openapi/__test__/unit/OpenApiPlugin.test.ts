import type {
  GeneratorContext,
  NormalizedOperation,
  NormalizedResponse,
  NormalizedResponseUsage,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { afterEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { OpenApiPlugin } from "../../src/index.js";
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

describe("OpenApiPlugin", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("writes an OpenAPI document to the default output path", () => {
    const context = anOpenApiGeneratorContextWith(aTodoSpecWith());

    new OpenApiPlugin().generate(context);

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
    const context = anOpenApiGeneratorContextWith(aTodoSpecWith());

    new OpenApiPlugin({
      info: { title: "Todo API", version: "1.0.0", summary: "Todos" },
      servers: [{ url: "https://api.example.com", description: "Production" }],
      outputPath: "docs/openapi.json",
    }).generate(context);

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

  test("warns without embedding builder warnings in the OpenAPI document", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const context = anOpenApiGeneratorContextWith(
      aTodoSpecWith({
        operations: [
          anOperationWith({
            path: "/items/:itemId",
            responses: [anInlineResponseUsage(aResponseWith())],
          }),
        ],
      })
    );

    new OpenApiPlugin().generate(context);

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
    expect(() => new OpenApiPlugin(options)).toThrow(message);
  });
});

function anOpenApiGeneratorContextWith(
  normalizedSpec: NormalizedSpec
): OpenApiGeneratorContext {
  const writtenFiles: WrittenFile[] = [];
  const notImplemented = (): never => {
    throw new Error("Not implemented by the OpenApiPlugin test context");
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

function aTodoSpecWith(
  overrides: {
    readonly operations?: readonly NormalizedOperation[];
    readonly responses?: readonly NormalizedResponse[];
  } = {}
): NormalizedSpec {
  return {
    resources: [
      {
        name: "Items",
        operations: overrides.operations ?? [
          anOperationWith({
            request: { param: z.object({ itemId: z.string() }) },
            responses: [anInlineResponseUsage(aResponseWith())],
          }),
        ],
      },
    ],
    responses: overrides.responses ?? [],
  };
}

function anOperationWith(
  overrides: Partial<NormalizedOperation> = {}
): NormalizedOperation {
  return {
    operationId: "getItem",
    method: "GET" as NormalizedOperation["method"],
    path: "/items/:itemId",
    summary: "Get item",
    responses: [],
    ...overrides,
  };
}

function aResponseWith(
  overrides: Partial<NormalizedResponse> = {}
): NormalizedResponse {
  return {
    name: "ItemLoaded",
    statusCode: 200 as NormalizedResponse["statusCode"],
    statusCodeName: "Ok",
    description: "Item loaded",
    kind: "response",
    body: z.object({ id: z.string(), name: z.string() }),
    ...overrides,
  };
}

function anInlineResponseUsage(
  response: NormalizedResponse
): NormalizedResponseUsage {
  return {
    responseName: response.name,
    source: "inline",
    response,
  };
}
