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

describe("normalizeSpec resource and operation ordering", () => {
  test("orders resources by object insertion order", () => {
    const spec = aSpec({
      todos: { operations: [anOperation({ operationId: "listTodos" })] },
      accounts: {
        operations: [
          anOperation({ operationId: "listAccounts", path: "/accounts" }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(normalizedSpec.resources.map(resource => resource.name)).toEqual([
      "todos",
      "accounts",
    ]);
  });

  test("orders operations by each resource operations array", () => {
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({ operationId: "listTodos", path: "/todos" }),
          anOperation({
            operationId: "createTodo",
            method: HttpMethod.POST,
            path: "/todos",
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(
      normalizedSpec.resources[0]?.operations.map(
        operation => operation.operationId
      )
    ).toEqual(["listTodos", "createTodo"]);
  });

  test("preserves operation fields", () => {
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            operationId: "createTodo",
            method: HttpMethod.POST,
            path: "/todos",
            summary: "Create a todo",
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation).toMatchObject({
      operationId: "createTodo",
      method: HttpMethod.POST,
      path: "/todos",
      summary: "Create a todo",
    });
  });
});

describe("normalizeSpec request preservation", () => {
  test("normalizes an empty request object to an absent request", () => {
    const spec = aSpec({
      todos: { operations: [anOperation({ request: {} })] },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request).toBeUndefined();
  });

  test("preserves request schemas by identity", () => {
    const header = z.object({ authorization: z.string() });
    const param = z.object({ todoId: z.string() });
    const query = z.object({
      includeDone: z.enum(["true", "false"]).optional(),
    });
    const body = z.object({ title: z.string() });
    const spec = aSpec({
      todos: {
        operations: [
          anOperation({
            path: "/todos/:todoId",
            request: { header, param, query, body },
          }),
        ],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.header).toBe(header);
    expect(operation.request?.param).toBe(param);
    expect(operation.request?.query).toBe(query);
    expect(operation.request?.body?.schema).toBe(body);
  });
});

describe("normalizeSpec inferred body transports", () => {
  test("uses an explicit request Content-Type literal as the body media type", () => {
    const header = z.object({ "Content-Type": z.literal("text/csv") });
    const body = z.string();
    const spec = aSpec({
      todos: {
        operations: [anOperation({ request: { header, body } })],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body).toEqual({
      schema: body,
      mediaType: "text/csv",
      mediaTypeSource: "content-type-header",
      transport: "text",
    });
    expect(normalizedSpec.warnings).toEqual([]);
  });

  test("uses an explicit response Content-Type literal as the body media type", () => {
    const header = z.object({ "Content-Type": z.literal("application/xml") });
    const body = z.string();
    const response = aCanonicalResponse("XmlResponse", { header, body });
    const spec = aSpec({
      todos: { operations: [anOperation({ responses: [response] })] },
    });

    const normalizedSpec = normalizeSpec(spec);

    expect(normalizedSpec.responses[0]?.body).toEqual({
      schema: body,
      mediaType: "application/xml",
      mediaTypeSource: "content-type-header",
      transport: "raw",
    });
    expect(normalizedSpec.warnings).toEqual([]);
  });

  test("infers JSON transport for object bodies without Content-Type", () => {
    const body = z.object({ title: z.string() });
    const spec = aSpec({
      todos: {
        operations: [anOperation({ request: { body } })],
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
        code: "missing-content-type-header",
        location: {
          resourceName: "todos",
          operationId: "getTodo",
          part: "request.body",
        },
      }) as unknown,
    ]);
  });

  test("infers text transport for string bodies without Content-Type", () => {
    const body = z.string();
    const spec = aSpec({
      todos: {
        operations: [anOperation({ request: { body } })],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body).toEqual({
      schema: body,
      mediaType: "text/plain",
      mediaTypeSource: "body-schema",
      transport: "text",
    });
    expect(normalizedSpec.warnings).toEqual([
      expect.objectContaining({
        code: "missing-content-type-header",
      }) as unknown,
    ]);
  });
});

describe("normalizeSpec literal and fallback body transports", () => {
  test.each([
    { scenario: "string literal", body: z.literal("ok") },
    { scenario: "string enum", body: z.enum(["ok", "created"]) },
  ])("infers text transport for $scenario bodies", ({ body }) => {
    const spec = aSpec({
      todos: {
        operations: [anOperation({ request: { body } })],
      },
    });

    const normalizedSpec = normalizeSpec(spec);
    const operation = theOnlyOperationIn(normalizedSpec);

    expect(operation.request?.body).toEqual({
      schema: body,
      mediaType: "text/plain",
      mediaTypeSource: "body-schema",
      transport: "text",
    });
    expect(normalizedSpec.warnings).toEqual([
      expect.objectContaining({
        code: "missing-content-type-header",
      }) as unknown,
    ]);
  });

  test.each([
    { scenario: "number literal", body: z.literal(1) },
    { scenario: "boolean literal", body: z.literal(true) },
  ])("keeps $scenario bodies as JSON", ({ body }) => {
    const spec = aSpec({
      todos: {
        operations: [anOperation({ request: { body } })],
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
  });

  test.each([
    { scenario: "any", body: z.any() },
    { scenario: "unknown", body: z.unknown() },
  ])(
    "falls back to raw transport for $scenario bodies without Content-Type",
    ({ body }) => {
      const spec = aSpec({
        todos: {
          operations: [anOperation({ request: { body } })],
        },
      });

      const normalizedSpec = normalizeSpec(spec);
      const operation = theOnlyOperationIn(normalizedSpec);

      expect(operation.request?.body).toEqual({
        schema: body,
        mediaType: "application/octet-stream",
        mediaTypeSource: "raw-fallback",
        transport: "raw",
      });
      expect(normalizedSpec.warnings.map(warning => warning.code)).toEqual([
        "missing-content-type-header",
        "raw-body-media-type-fallback",
      ]);
    }
  );
});
