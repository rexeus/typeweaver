import {
  DuplicateResponseNameError,
  defineDerivedResponse,
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
import { Cause, Effect, Either } from "effect";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  DerivedResponseCycleError,
  DuplicateOperationIdError,
  DuplicateRouteError,
  EmptyOperationResponsesError,
  EmptyResourceOperationsError,
  EmptySpecResourcesError,
  InvalidDerivedResponseError,
  InvalidOperationIdError,
  InvalidRequestSchemaError,
  InvalidResourceNameError,
  MissingDerivedResponseParentError,
  normalizeSpec as normalizeSpecEffect,
  PathParameterMismatchError,
} from "../src/index.js";
import { TestAssertionError } from "./errors/index.js";
import type { NormalizedSpec } from "../src/index.js";

// Test shim that bridges the legacy sync call surface onto the new Effect
// API. `Effect.either` flattens typed failures into the success channel
// so the existing `toThrowError` / `instanceof` assertions keep working
// against the underlying error rather than Effect's `FiberFailure` wrapper.
const normalizeSpec = (spec: SpecDefinition): NormalizedSpec => {
  const result = Effect.runSync(Effect.either(normalizeSpecEffect(spec)));
  if (Either.isLeft(result)) throw result.left;
  return result.right;
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

const aSpec = (resources: SpecDefinition["resources"]): SpecDefinition => {
  return defineSpec({ resources });
};

const aMalformedSpec = (
  resources: SpecDefinition["resources"]
): SpecDefinition => {
  return { resources };
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

const withDerivedMetadata = <TResponse extends ResponseDefinition>(
  response: TResponse,
  metadata: NonNullable<ResponseDefinition["derived"]>
): TResponse => {
  Object.defineProperty(response, "derived", {
    value: metadata,
    enumerable: true,
    configurable: true,
    writable: true,
  });

  return response;
};

describe("normalizeSpec", () => {
  describe("normalization contracts", () => {
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
      const query = z.object({ includeDone: z.coerce.boolean().optional() });
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
        }),
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
        expect.objectContaining({ code: "missing-content-type-header" }),
      ]);
    });

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
        expect.objectContaining({ code: "missing-content-type-header" }),
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
        expect.objectContaining({ code: "ambiguous-content-type-header" }),
      ]);
    });

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
          expect.objectContaining({ code: "missing-content-type-header" }),
        ]);
      }
    );

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
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              request: {
                header: z.object({
                  "Content-Type": z.literal("application/json"),
                  "content-type": z.literal("text/plain"),
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
        mediaType: "application/json",
        mediaTypeSource: "body-schema",
        transport: "json",
      });
      expect(normalizedSpec.warnings).toEqual([
        expect.objectContaining({ code: "ambiguous-content-type-header" }),
      ]);
    });

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

  describe("empty definitions", () => {
    test("rejects specs without resources", () => {
      expect(() => normalizeSpec(aMalformedSpec({}))).toThrowError(
        EmptySpecResourcesError
      );
    });

    test("rejects resources without operations", () => {
      const spec = aSpec({ todos: { operations: [] } });

      expect(() => normalizeSpec(spec)).toThrowError(
        EmptyResourceOperationsError
      );
    });

    test("rejects operations without responses", () => {
      const spec = aSpec({
        todos: { operations: [anOperation({ responses: [] })] },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        EmptyOperationResponsesError
      );
    });
  });

  describe("identity and name validation", () => {
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

      expect(() => normalizeSpec(spec)).toThrowError(InvalidOperationIdError);
    });

    test.each([
      { scenario: "snake_case", resourceName: "user_profile" },
      { scenario: "kebab-case", resourceName: "user-profile" },
      { scenario: "leading digit", resourceName: "1userProfile" },
    ])("rejects $scenario resource names", ({ resourceName }) => {
      const spec = aSpec({
        [resourceName]: { operations: [anOperation()] },
      });

      expect(() => normalizeSpec(spec)).toThrowError(InvalidResourceNameError);
    });

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

      expect(() => normalizeSpec(spec)).toThrowError(
        DuplicateResponseNameError
      );
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

      expect(() => normalizeSpec(spec)).toThrowError(
        DuplicateResponseNameError
      );
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

      expect(() => normalizeSpec(spec)).toThrowError(
        DuplicateResponseNameError
      );
    });
  });

  describe("route validation", () => {
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

    test("rejects trailing slash route conflicts", () => {
      const okResponse = aCanonicalResponse("SharedResponse");
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              operationId: "listTodos",
              path: "/todos",
              responses: [okResponse],
            }),
            anOperation({
              operationId: "listTodosWithSlash",
              path: "/todos/",
              responses: [okResponse],
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(DuplicateRouteError);
    });

    test("rejects route conflicts across resources", () => {
      const okResponse = aCanonicalResponse("SharedResponse");
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ operationId: "getTodo", responses: [okResponse] }),
          ],
        },
        accounts: {
          operations: [
            anOperation({
              operationId: "getAccountTodo",
              path: "/todos",
              responses: [okResponse],
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(DuplicateRouteError);
    });
  });

  describe("request and path parameter validation", () => {
    test("rejects path parameters without request.param", () => {
      const spec = aSpec({
        todos: {
          operations: [anOperation({ path: "/todos/:todoId", request: {} })],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        PathParameterMismatchError
      );
    });

    test("rejects request.param keys without path placeholders", () => {
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              path: "/todos",
              request: { param: z.object({ todoId: z.string() }) },
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        PathParameterMismatchError
      );
    });

    test("rejects request.param keys that do not match path placeholder names", () => {
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              path: "/todos/:todoId",
              request: { param: z.object({ id: z.string() }) },
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        PathParameterMismatchError
      );
    });

    test("accepts matching path parameters in a different object key order", () => {
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              path: "/orgs/:orgId/todos/:todoId",
              request: {
                param: z.object({ todoId: z.string(), orgId: z.string() }),
              },
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(theOnlyOperationIn(normalizedSpec).request?.param?.shape).toEqual(
        expect.objectContaining({
          orgId: expect.any(Object),
          todoId: expect.any(Object),
        })
      );
    });

    test("rejects request.param schemas that are not Zod objects", () => {
      const spec = aMalformedSpec({
        todos: {
          operations: [
            anOperation({
              path: "/todos/:todoId",
              request: { param: z.string() } as unknown as RequestDefinition,
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(InvalidRequestSchemaError);
    });

    test.each([
      { scenario: "header", request: { header: { parse: () => ({}) } } },
      { scenario: "query", request: { query: { parse: () => ({}) } } },
      { scenario: "body", request: { body: { parse: () => ({}) } } },
    ])(
      "rejects request.$scenario values that are not Zod schemas",
      ({ request }) => {
        const spec = aMalformedSpec({
          todos: {
            operations: [
              anOperation({ request: request as unknown as RequestDefinition }),
            ],
          },
        });

        expect(() => normalizeSpec(spec)).toThrowError(
          InvalidRequestSchemaError
        );
      }
    );
  });

  describe("canonical and derived response graph validation", () => {
    test("rejects derived responses whose parent canonical response is absent", () => {
      const parentResponse = aCanonicalResponse("ParentResponse");
      const childResponse = defineDerivedResponse(parentResponse, {
        name: "ChildResponse",
      });
      const spec = aSpec({
        todos: { operations: [anOperation({ responses: [childResponse] })] },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        MissingDerivedResponseParentError
      );
    });

    test("accepts derived responses whose parent canonical response appears later", () => {
      const parentResponse = aCanonicalResponse("ParentResponse");
      const childResponse = defineDerivedResponse(parentResponse, {
        name: "ChildResponse",
      });
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              operationId: "getChild",
              responses: [childResponse],
            }),
            anOperation({
              operationId: "getParent",
              path: "/parents",
              responses: [parentResponse],
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(normalizedSpec.responses.map(response => response.name)).toEqual([
        "ChildResponse",
        "ParentResponse",
      ]);
    });

    test("normalizes multi-level derived response chains with immediate parent and full lineage", () => {
      const rootResponse = aCanonicalResponse("RootResponse");
      const childResponse = defineDerivedResponse(rootResponse, {
        name: "ChildResponse",
      });
      const grandchildResponse = defineDerivedResponse(childResponse, {
        name: "GrandchildResponse",
      });
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              responses: [rootResponse, childResponse, grandchildResponse],
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);
      expect(
        normalizedSpec.responses.find(
          response => response.name === "GrandchildResponse"
        )
      ).toMatchObject({
        name: "GrandchildResponse",
        kind: "derived-response",
        derivedFrom: "ChildResponse",
        lineage: ["ChildResponse", "GrandchildResponse"],
        depth: 2,
      });
    });

    test("keeps an inline derived response local when its canonical parent is present", () => {
      const parentResponse = aCanonicalResponse("ParentResponse");
      const inlineResponse = anInlineResponse("InlineDerivedResponse", {
        derived: {
          parentName: "ParentResponse",
          lineage: ["InlineDerivedResponse"],
          depth: 1,
        },
      });
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [parentResponse, inlineResponse] }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(normalizedSpec.responses.map(response => response.name)).toEqual([
        "ParentResponse",
      ]);
      expect(normalizedSpec.resources[0]?.operations[0]?.responses[1]).toEqual({
        responseName: "InlineDerivedResponse",
        source: "inline",
        response: expect.objectContaining({
          name: "InlineDerivedResponse",
          kind: "derived-response",
          derivedFrom: "ParentResponse",
          lineage: ["InlineDerivedResponse"],
          depth: 1,
        }),
      });
    });

    test("keeps an inline derived response local when its parent is a derived canonical response", () => {
      const rootResponse = aCanonicalResponse("RootResponse");
      const childResponse = defineDerivedResponse(rootResponse, {
        name: "ChildResponse",
      });
      const inlineGrandchildResponse = anInlineResponse(
        "InlineGrandchildResponse",
        {
          derived: {
            parentName: "ChildResponse",
            lineage: ["ChildResponse", "InlineGrandchildResponse"],
            depth: 2,
          },
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              responses: [
                rootResponse,
                childResponse,
                inlineGrandchildResponse,
              ],
            }),
          ],
        },
      });

      const normalizedSpec = normalizeSpec(spec);

      expect(normalizedSpec.responses.map(response => response.name)).toEqual([
        "RootResponse",
        "ChildResponse",
      ]);
      expect(normalizedSpec.resources[0]?.operations[0]?.responses[2]).toEqual({
        responseName: "InlineGrandchildResponse",
        source: "inline",
        response: expect.objectContaining({
          name: "InlineGrandchildResponse",
          kind: "derived-response",
          derivedFrom: "ChildResponse",
          lineage: ["ChildResponse", "InlineGrandchildResponse"],
          depth: 2,
        }),
      });
    });

    test("rejects derived response metadata whose lineage length disagrees with depth", () => {
      const parentResponse = aCanonicalResponse("ParentResponse");
      const childResponse = withDerivedMetadata(
        aCanonicalResponse("ChildResponse"),
        {
          parentName: "ParentResponse",
          lineage: ["ChildResponse"],
          depth: 2,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [parentResponse, childResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        InvalidDerivedResponseError
      );
    });

    test("rejects derived response metadata with empty lineage", () => {
      const parentResponse = aCanonicalResponse("ParentResponse");
      const childResponse = withDerivedMetadata(
        aCanonicalResponse("ChildResponse"),
        {
          parentName: "ParentResponse",
          lineage: [],
          depth: 0,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [parentResponse, childResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        InvalidDerivedResponseError
      );
    });

    test("rejects multi-level derived response metadata whose immediate parent disagrees with lineage", () => {
      const rootResponse = aCanonicalResponse("RootResponse");
      const grandchildResponse = withDerivedMetadata(
        aCanonicalResponse("GrandchildResponse"),
        {
          parentName: "RootResponse",
          lineage: ["IntermediateResponse", "GrandchildResponse"],
          depth: 2,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [rootResponse, grandchildResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        InvalidDerivedResponseError
      );
    });

    test("rejects derived response metadata whose lineage repeats a response name", () => {
      const childResponse = aCanonicalResponse("ChildResponse");
      const grandchildResponse = withDerivedMetadata(
        aCanonicalResponse("GrandchildResponse"),
        {
          parentName: "ChildResponse",
          lineage: [
            "ChildResponse",
            "GrandchildResponse",
            "GrandchildResponse",
          ],
          depth: 3,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [childResponse, grandchildResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
    });

    test("rejects derived response graph cycles between distinct canonical responses", () => {
      const firstResponse = withDerivedMetadata(
        aCanonicalResponse("FirstResponse"),
        {
          parentName: "SecondResponse",
          lineage: ["FirstResponse"],
          depth: 1,
        }
      );
      const secondResponse = withDerivedMetadata(
        aCanonicalResponse("SecondResponse"),
        {
          parentName: "FirstResponse",
          lineage: ["SecondResponse"],
          depth: 1,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [firstResponse, secondResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
    });

    test("rejects derived response cycles from malformed metadata", () => {
      const cyclicResponse = withDerivedMetadata(
        aCanonicalResponse("CyclicResponse"),
        {
          parentName: "CyclicResponse",
          lineage: ["CyclicResponse"],
          depth: 1,
        }
      );
      const spec = aSpec({
        todos: { operations: [anOperation({ responses: [cyclicResponse] })] },
      });

      expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
    });

    test("rejects frozen authored responses with cyclic derived metadata", () => {
      const cyclicResponse = defineResponse(
        Object.freeze({
          name: "FrozenCyclicResponse",
          statusCode: HttpStatusCode.OK,
          description: "Frozen cyclic response",
          derived: {
            parentName: "FrozenCyclicResponse",
            lineage: ["FrozenCyclicResponse"],
            depth: 1,
          },
        })
      );
      const spec = aSpec({
        todos: { operations: [anOperation({ responses: [cyclicResponse] })] },
      });

      expect(() => normalizeSpec(spec)).toThrowError(DerivedResponseCycleError);
    });

    test("rejects derived responses whose lineage metadata disagrees with the graph", () => {
      const parentResponse = aCanonicalResponse("ParentResponse");
      const childResponse = withDerivedMetadata(
        defineDerivedResponse(parentResponse, {
          name: "ChildResponse",
        }),
        {
          parentName: "ParentResponse",
          lineage: ["WrongResponse"],
          depth: 1,
        }
      );
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({ responses: [parentResponse, childResponse] }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        InvalidDerivedResponseError
      );
    });

    test("rejects inline derived response metadata whose parent is absent", () => {
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              responses: [
                anInlineResponse("InlineDerivedResponse", {
                  derived: {
                    parentName: "MissingParentResponse",
                    lineage: ["InlineDerivedResponse"],
                    depth: 1,
                  },
                }),
              ],
            }),
          ],
        },
      });

      expect(() => normalizeSpec(spec)).toThrowError(
        MissingDerivedResponseParentError
      );
    });
  });

  // The legacy tests above use a sync shim for parity with the pre-Effect
  // API. The cases below demonstrate the Effect-native shape that new code
  // and reviewers should reach for: tagged-error matching via Cause inspection,
  // recoverable handling via `Effect.catchTag`, etc.
  describe("effect-native error channel", () => {
    test("typed failure carries the offending operation ID", async () => {
      const sharedResponse = aCanonicalResponse("SharedResponse");
      const spec = aSpec({
        todos: {
          operations: [
            anOperation({
              operationId: "duplicate",
              path: "/a",
              responses: [sharedResponse],
            }),
          ],
        },
        accounts: {
          operations: [
            anOperation({
              operationId: "duplicate",
              path: "/b",
              responses: [sharedResponse],
            }),
          ],
        },
      });

      const exit = await Effect.runPromise(
        Effect.exit(normalizeSpecEffect(spec))
      );

      if (exit._tag !== "Failure") {
        throw new TestAssertionError("expected normalize to fail");
      }

      const failureOption = Cause.failureOption(exit.cause);
      if (failureOption._tag !== "Some") {
        throw new TestAssertionError("expected a Cause.Fail");
      }

      const failure = failureOption.value;
      expect(failure._tag).toBe("DuplicateOperationIdError");
      if (!(failure instanceof DuplicateOperationIdError)) {
        throw new TestAssertionError(
          "expected DuplicateOperationIdError instance"
        );
      }
      expect(failure.operationId).toBe("duplicate");
    });

    test("Effect.catchTag recovers from a specific normalization error", async () => {
      const spec = aSpec({});

      const recovered = await Effect.runPromise(
        normalizeSpecEffect(spec).pipe(
          Effect.catchTag("EmptySpecResourcesError", () =>
            Effect.succeed("empty-fallback" as const)
          )
        )
      );

      expect(recovered).toBe("empty-fallback");
    });
  });
});
