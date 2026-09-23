import { HttpMethod, HttpStatusCode } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  EmptyOperationResponsesError,
  EmptyResourceOperationsError,
  EmptySpecResourcesError,
} from "../../src/index.js";
import {
  aCanonicalResponse,
  aMalformedSpec,
  anInlineResponse,
  anOperation,
  aSpec,
  captureNormalizeErrorOf,
  normalizeSpec,
  theOnlyOperationIn,
} from "./fixtures.js";

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

    const error = captureNormalizeErrorOf(spec, EmptyResourceOperationsError);
    expect(error).toBeInstanceOf(EmptyResourceOperationsError);
    expect(error.resourceName).toBe("todos");
  });

  test("rejects operations without responses", () => {
    const spec = aSpec({
      todos: {
        operations: [anOperation({ operationId: "noResp", responses: [] })],
      },
    });

    const error = captureNormalizeErrorOf(spec, EmptyOperationResponsesError);
    expect(error).toBeInstanceOf(EmptyOperationResponsesError);
    expect(error.operationId).toBe("noResp");
  });
});
