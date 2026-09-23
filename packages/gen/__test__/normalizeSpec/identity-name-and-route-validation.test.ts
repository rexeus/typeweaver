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
  DuplicateOperationIdError,
  DuplicateResponseNameError,
  DuplicateRouteError,
  InvalidOperationIdError,
  InvalidResourceNameError,
  normalizeSpec as normalizeSpecEffect,
} from "../../src/index.js";
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

describe("normalizeSpec identity and name validation", () => {
  test("rejects duplicate operation IDs globally", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ operationId: "getItem", responses: [okResponse] }),
        ],
      },
      accounts: {
        operations: [
          anOperation({
            operationId: "getItem",
            path: "/accounts",
            responses: [okResponse],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateOperationIdError);
  });

  test.each([
    { scenario: "snake_case", operationId: "get_todo" },
    { scenario: "kebab-case", operationId: "get-todo" },
    { scenario: "leading digit", operationId: "1getTodo" },
  ])("rejects $scenario operation IDs", ({ operationId }) => {
    const spec = aSpec({
      todos: { operations: [anOperation({ operationId })] },
    });

    const error = captureNormalizeError(spec);
    expect(error).toBeInstanceOf(InvalidOperationIdError);
    expect((error as InvalidOperationIdError).operationId).toBe(operationId);
  });

  test.each([
    { scenario: "snake_case", resourceName: "user_profile" },
    { scenario: "kebab-case", resourceName: "user-profile" },
    { scenario: "leading digit", resourceName: "1userProfile" },
  ])("rejects $scenario resource names", ({ resourceName }) => {
    const spec = aSpec({
      [resourceName]: { operations: [anOperation()] },
    });

    const error = captureNormalizeError(spec);
    expect(error).toBeInstanceOf(InvalidResourceNameError);
    expect((error as InvalidResourceNameError).resourceName).toBe(resourceName);
  });
});

describe("normalizeSpec response name validation", () => {
  test("rejects duplicate canonical response names", () => {
    const spec = aMalformedSpec({
      todos: {
        operations: [
          anOperation({
            operationId: "listTodos",
            responses: [aCanonicalResponse("DuplicateResponse")],
          }),
          anOperation({
            operationId: "createTodo",
            method: HttpMethod.POST,
            path: "/todos",
            responses: [aCanonicalResponse("DuplicateResponse")],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateResponseNameError);
  });

  test("rejects duplicate inline response names", () => {
    const spec = aMalformedSpec({
      todos: {
        operations: [
          anOperation({
            operationId: "listTodos",
            responses: [anInlineResponse("DuplicateInlineResponse")],
          }),
          anOperation({
            operationId: "createTodo",
            method: HttpMethod.POST,
            path: "/todos",
            responses: [anInlineResponse("DuplicateInlineResponse")],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateResponseNameError);
  });

  test("rejects inline response names that collide with canonical responses", () => {
    const spec = aMalformedSpec({
      todos: {
        operations: [
          anOperation({
            operationId: "listTodos",
            responses: [aCanonicalResponse("TodoResponse")],
          }),
          anOperation({
            operationId: "createTodo",
            method: HttpMethod.POST,
            path: "/todos",
            responses: [anInlineResponse("TodoResponse")],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateResponseNameError);
  });
});

describe("normalizeSpec route validation", () => {
  test("rejects the same method and normalized path when path parameter names differ", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            operationId: "getTodo",
            path: "/todos/:todoId",
            request: { param: z.object({ todoId: z.string() }) },
            responses: [okResponse],
          }),
          anOperation({
            operationId: "getAccountTodo",
            path: "/todos/:accountId",
            request: { param: z.object({ accountId: z.string() }) },
            responses: [okResponse],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateRouteError);
  });

  test("accepts the same normalized path with different HTTP methods", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
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

    expect(normalizedSpec.resources[0]?.operations).toHaveLength(2);
  });
});

describe("normalizeSpec embedded route validation", () => {
  test("distinguishes bare and embedded parameterized routes", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      files: {
        operations: [
          anOperation({
            operationId: "getFile",
            path: "/files/:fileId",
            request: { param: z.object({ fileId: z.string() }) },
            responses: [okResponse],
          }),
          anOperation({
            operationId: "getFileFormat",
            path: "/files/:fileId.:format",
            request: {
              param: z.object({ fileId: z.string(), format: z.string() }),
            },
            responses: [okResponse],
          }),
        ],
      },
    });

    expect(normalizeSpec(spec).resources[0]?.operations).toHaveLength(2);
  });

  test("rejects renamed embedded routes with the same literal shape", () => {
    const okResponse = aCanonicalResponse("SharedResponse");
    const spec = aSpec({
      files: {
        operations: [
          anOperation({
            operationId: "getFileFormat",
            path: "/files/:fileId.:format",
            request: {
              param: z.object({ fileId: z.string(), format: z.string() }),
            },
            responses: [okResponse],
          }),
          anOperation({
            operationId: "getNamedFileFormat",
            path: "/files/:name.:extension",
            request: {
              param: z.object({ name: z.string(), extension: z.string() }),
            },
            responses: [okResponse],
          }),
        ],
      },
    });

    expect(() => normalizeSpec(spec)).toThrowError(DuplicateRouteError);
  });
});
