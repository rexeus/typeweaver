import {
  defineOperation,
  defineResponse,
  defineSpec,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import type {
  RequestDefinition,
  ResponseDefinition,
  SpecDefinition,
} from "@rexeus/typeweaver-core";
import { Effect, Result } from "effect";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { normalizeSpec as normalizeSpecEffect } from "../../src/index.js";
import { TestAssertionError } from "../errors/index.js";
import type { NormalizedSpec } from "../../src/index.js";

// Test shim that bridges the legacy sync call surface onto the new Effect
// API. `Effect.result` flattens typed failures into the success channel
// so the existing `toThrowError` / `instanceof` assertions keep working
// against the underlying error rather than Effect's `FiberFailure` wrapper.
const normalizeSpec = (spec: SpecDefinition): NormalizedSpec => {
  const result = Effect.runSync(Effect.result(normalizeSpecEffect(spec)));
  if (Result.isFailure(result)) throw result.failure;
  return result.success;
};

type ResponseBaseOverrides = {
  readonly statusCode?: HttpStatusCode;
  readonly description?: string;
  readonly header?: ResponseDefinition["header"];
  readonly body?: ResponseDefinition["body"];
};

type OperationOverrides = {
  readonly operationId?: string;
  readonly method?: HttpMethod;
  readonly path?: string;
  readonly summary?: string;
  readonly request?: RequestDefinition;
  readonly responses?: readonly ResponseDefinition[];
};

const aResponseNameFor = (operationId: string): string => {
  const identifier = operationId.replace(/[^A-Za-z0-9]/gu, "");

  return `${identifier.charAt(0).toUpperCase()}${identifier.slice(1)}Response`;
};

const aCanonicalResponse = (
  name = "OkResponse",
  overrides: ResponseBaseOverrides = {}
): ResponseDefinition => {
  return defineResponse({
    name,
    statusCode: overrides.statusCode ?? HttpStatusCode.OK,
    description: overrides.description ?? `${name} description`,
    header: overrides.header,
    body: overrides.body,
  });
};

const anOperation = (overrides: OperationOverrides = {}) => {
  const operationId = overrides.operationId ?? "getTodo";

  return defineOperation({
    operationId,
    method: overrides.method ?? HttpMethod.GET,
    path: overrides.path ?? "/todos",
    summary: overrides.summary ?? `${operationId} summary`,
    request: overrides.request ?? {},
    responses: overrides.responses ?? [
      aCanonicalResponse(aResponseNameFor(operationId)),
    ],
  });
};

const testMetadata = {
  title: "Normalization Test API",
  version: "1.0.0",
} as const;

const aSpec = (resources: SpecDefinition["resources"]): SpecDefinition => {
  return defineSpec({ metadata: testMetadata, resources });
};

const theOnlyOperationIn = (
  normalizedSpec: ReturnType<typeof normalizeSpec>
) => {
  const operation = normalizedSpec.resources[0]?.operations[0];

  if (operation === undefined) {
    throw new TestAssertionError(
      "Expected the normalized spec to contain one operation."
    );
  }

  return operation;
};

describe("normalizeSpec explicit media types and headers", () => {
  test("preserves custom explicit media types with raw transport", () => {
    const body = z.object({ event: z.string() });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            request: {
              header: z.object({
                "content-type": z.literal("application/vnd.todo+custom"),
              }),
              body,
            },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body).toEqual({
      schema: body,
      mediaType: "application/vnd.todo+custom",
      mediaTypeSource: "content-type-header",
      transport: "raw",
    });
    expect(normalizedSpec.warnings).toEqual([]);
  });

  test("does not mutate authored header schemas when Content-Type is inferred", () => {
    const header = z.object({ authorization: z.string() });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            request: { header, body: z.object({ title: z.string() }) },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.header).toBe(header);
    expect(Object.keys(header.shape)).toEqual(["authorization"]);
    expect(operation.request?.body?.mediaType).toBe("application/json");
  });

  test("finds Content-Type headers case-insensitively", () => {
    const body = z.string();
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            request: {
              header: z.object({
                "cOnTeNt-TyPe": z.literal("text/markdown"),
              }),
              body,
            },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body).toEqual({
      schema: body,
      mediaType: "text/markdown",
      mediaTypeSource: "content-type-header",
      transport: "text",
    });
  });
});

describe("normalizeSpec ambiguous Content-Type warnings", () => {
  test("warns and infers media type for ambiguous Content-Type headers", () => {
    const body = z.object({ title: z.string() });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            request: {
              header: z.object({
                "Content-Type": z.enum(["application/json", "text/plain"]),
              }),
              body,
            },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body?.mediaType).toBe("application/json");
    expect(normalizedSpec.warnings).toEqual([
      expect.objectContaining({
        code: "ambiguous-content-type-header",
      }) as unknown,
    ]);
  });
});

describe("normalizeSpec wrapped body schemas", () => {
  test.each([
    {
      scenario: "optional object",
      body: z.object({ title: z.string() }).optional(),
      mediaType: "application/json",
      transport: "json",
    },
    {
      scenario: "nullable object",
      body: z.object({ title: z.string() }).nullable(),
      mediaType: "application/json",
      transport: "json",
    },
    {
      scenario: "default object",
      body: z.object({ title: z.string() }).default({ title: "Untitled" }),
      mediaType: "application/json",
      transport: "json",
    },
    {
      scenario: "readonly object",
      body: z.object({ title: z.string() }).readonly(),
      mediaType: "application/json",
      transport: "json",
    },
    {
      scenario: "optional string",
      body: z.string().optional(),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "nullable string",
      body: z.string().nullable(),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "default string",
      body: z.string().default("Untitled"),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "catch string",
      body: z.string().catch("Untitled"),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "prefault string",
      body: z.string().prefault("Untitled"),
      mediaType: "text/plain",
      transport: "text",
    },
    {
      scenario: "typed pipe string",
      body: z.string().pipe(z.string()),
      mediaType: "text/plain",
      transport: "text",
    },
  ])(
    "infers $mediaType for $scenario bodies without replacing the schema",
    ({ body, mediaType, transport }) => {
      const spec = aSpec({
        todos: {
          operations: [anOperation({ request: { body } })],
        },
      });

      const normalizedSpec = normalizeSpec(spec);
      const operation = theOnlyOperationIn(normalizedSpec);

      expect(operation.request?.body).toEqual({
        schema: body,
        mediaType,
        mediaTypeSource: "body-schema",
        transport,
      });
      expect(operation.request?.body?.schema).toBe(body);
      expect(normalizedSpec.warnings).toEqual([
        expect.objectContaining({
          code: "missing-content-type-header",
        }) as unknown,
      ]);
    }
  );
});
