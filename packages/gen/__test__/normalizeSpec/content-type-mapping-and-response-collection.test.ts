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
import {
  EmptyOperationResponsesError,
  EmptyResourceOperationsError,
  EmptySpecResourcesError,
  normalizeSpec as normalizeSpecEffect,
} from "../../src/index.js";
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

// Capture the typed failure from `normalizeSpecEffect` without rethrowing
// so tests can assert on discriminating fields (resourceName, operationId,
// etc.) — not just the error class.
const captureNormalizeError = (spec: SpecDefinition): unknown => {
  const result = Effect.runSync(Effect.result(normalizeSpecEffect(spec)));
  if (Result.isSuccess(result)) {
    throw new Error("Expected normalization to fail but it succeeded");
  }
  return result.failure;
};

type ResponseBaseOverrides = {
  readonly statusCode?: HttpStatusCode;
  readonly description?: string;
  readonly header?: ResponseDefinition["header"];
  readonly body?: ResponseDefinition["body"];
};

type InlineResponseOverrides = ResponseBaseOverrides & {
  readonly derived?: NonNullable<ResponseDefinition["derived"]>;
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

const anInlineResponse = (
  name = "InlineResponse",
  overrides: InlineResponseOverrides = {}
): ResponseDefinition => {
  return {
    name,
    statusCode: overrides.statusCode ?? HttpStatusCode.BAD_REQUEST,
    description: overrides.description ?? `${name} description`,
    header: overrides.header,
    body: overrides.body,
    derived: overrides.derived,
  };
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

const aMalformedSpec = (
  resources: SpecDefinition["resources"]
): SpecDefinition => {
  return { metadata: testMetadata, resources };
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

describe("normalizeSpec explicit Content-Type transport mapping", () => {
  test.each([
    {
      scenario: "vendor JSON",
      mediaType: "application/vnd.api+json",
      transport: "json",
    },
    {
      scenario: "parameterized JSON",
      mediaType: "Application/JSON; charset=utf-8",
      transport: "json",
    },
    {
      scenario: "form-urlencoded",
      mediaType: "application/x-www-form-urlencoded",
      transport: "form-url-encoded",
    },
    {
      scenario: "multipart",
      mediaType: "multipart/form-data",
      transport: "multipart",
    },
  ])(
    "resolves $scenario explicit Content-Type to $transport transport",
    ({ mediaType, transport }) => {
      const body = z.any();
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              request: {
                header: z.object({ "Content-Type": z.literal(mediaType) }),
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
        mediaType,
        mediaTypeSource: "content-type-header",
        transport,
      });
      expect(normalizedSpec.warnings).toEqual([]);
    }
  );

  test("warns and infers media type for conflicting Content-Type header keys", () => {
    const body = z.object({ title: z.string() });
    const authoredOperation = {
      ...anOperation(),
      request: {
        header: z.object({
          "Content-Type": z.literal("application/json"),
          "content-type": z.literal("text/plain"),
        }),
        body,
      },
    };
    const spec = aMalformedSpec({
      todos: {
        operations: [authoredOperation],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body).toEqual({
      schema: body,
      mediaType: "application/json",
      mediaTypeSource: "body-schema",
      transport: "json",
    });
    expect(normalizedSpec.warnings).toEqual([
      expect.objectContaining({
        code: "ambiguous-content-type-header",
      }) as unknown,
    ]);
  });
});

describe("normalizeSpec canonical response collection", () => {
  test("lists each canonical response once at the top level", () => {
    const okResponse = aCanonicalResponse("OkResponse");
    const conflictResponse = aCanonicalResponse("ConflictResponse", {
      statusCode: HttpStatusCode.CONFLICT,
    });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ responses: [okResponse, conflictResponse] }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(normalizedSpec.responses.map(response => response.name)).toEqual([
      "OkResponse",
      "ConflictResponse",
    ]);
  });

  test("dedupes the same canonical response object reused across operations", () => {
    const okResponse = aCanonicalResponse("SharedTodoResponse");
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ operationId: "listTodos", responses: [okResponse] }),
          anOperation({
            operationId: "createTodo",
            method: HttpMethod.POST,
            path: "/todos",
            responses: [okResponse],
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(normalizedSpec.responses).toHaveLength(1);
    expect(
      normalizedSpec.resources[0]?.operations.flatMap(
        operation => operation.responses
      )
    ).toEqual([
      { responseName: "SharedTodoResponse", source: "canonical" },
      { responseName: "SharedTodoResponse", source: "canonical" },
    ]);
  });

  test("represents canonical operation usages without inline response details", () => {
    const okResponse = aCanonicalResponse("TodoResponse");
    const spec = aSpec({
      todos: { operations: [anOperation({ responses: [okResponse] })] },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);
    expect(operation.responses[0]).toEqual({
      responseName: "TodoResponse",
      source: "canonical",
    });
  });
});

describe("normalizeSpec inline response collection", () => {
  test("keeps inline responses operation-local with their public normalized shape", () => {
    const header = z.object({ "x-retry-after": z.string() });
    const body = z.object({ message: z.string() });
    const inlineResponse = anInlineResponse("ValidationErrorResponse", {
      statusCode: HttpStatusCode.BAD_REQUEST,
      description: "Validation failed",
      header,
      body,
    });
    const spec = aSpec({
      todos: { operations: [anOperation({ responses: [inlineResponse] })] },
    });

    const normalizedSpec = normalizeSpec(spec);
    expect(normalizedSpec.responses).toEqual([]);
    expect(normalizedSpec.resources[0]?.operations[0]?.responses[0]).toEqual({
      responseName: "ValidationErrorResponse",
      source: "inline",
      response: {
        name: "ValidationErrorResponse",
        statusCode: HttpStatusCode.BAD_REQUEST,
        statusCodeName: "BadRequest",
        description: "Validation failed",
        header,
        body: {
          schema: body,
          mediaType: "application/json",
          mediaTypeSource: "body-schema",
          transport: "json",
        },
        kind: "response",
        derivedFrom: undefined,
        lineage: undefined,
        depth: undefined,
      },
    });
  });
});

describe("normalizeSpec empty definitions", () => {
  test("rejects specs without resources", () => {
    expect(() => normalizeSpec(aMalformedSpec({}))).toThrowError(
      EmptySpecResourcesError
    );
  });

  test("rejects resources without operations", () => {
    const spec = aSpec({ todos: { operations: [] } });

    const error = captureNormalizeError(spec);
    expect(error).toBeInstanceOf(EmptyResourceOperationsError);
    expect((error as EmptyResourceOperationsError).resourceName).toBe("todos");
  });

  test("rejects operations without responses", () => {
    const spec = aSpec({
      todos: {
        operations: [anOperation({ operationId: "noResp", responses: [] })],
      },
    });

    const error = captureNormalizeError(spec);
    expect(error).toBeInstanceOf(EmptyOperationResponsesError);
    expect((error as EmptyOperationResponsesError).operationId).toBe("noResp");
  });
});
