import type { NormalizedOperation } from "@rexeus/typeweaver-gen";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { buildOpenApiDocument } from "../../../src/index.js";
import {
  anInlineResponseUsage,
  anOperationWith,
  aQuerySchemaForBuilder,
  aResponseWith,
  aTodoSpecWith,
  todoApiOptions,
} from "../../helpers.js";
import { aCanonicalOkResponse, anInlineOkResponse } from "./fixtures.js";

describe("buildOpenApiDocument root warning paths", () => {
  test("keeps root query container warnings at the parameter list boundary", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          request: {
            query: aQuerySchemaForBuilder(z.custom<Record<string, string>>()),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-schema",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
        schemaType: "custom",
        schemaPath: "",
        documentPath: "/paths/~1todos/get/parameters",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.query",
          parameterName: undefined,
          responseName: undefined,
          statusCode: undefined,
        },
      },
      {
        origin: "openapi-builder",
        code: "unrepresentable-parameter-container",
        message:
          "request.query must be a finite object schema to become OpenAPI parameters.",
        documentPath: "/paths/~1todos/get/parameters",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.query",
          parameterName: undefined,
          responseName: undefined,
          statusCode: undefined,
        },
      },
    ]);
  });
});

describe("buildOpenApiDocument nested warning paths", () => {
  test("rebases schema conversion warnings to the OpenAPI request body path", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          operationId: "createTodo",
          method: "POST" as NormalizedOperation["method"],
          request: { body: z.object({ value: z.custom<string>() }) },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-schema",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
        schemaType: "custom",
        schemaPath: "/properties/value",
        documentPath:
          "/components/schemas/CreateTodoRequestBody/properties/value",
        location: {
          resourceName: "Todos",
          operationId: "createTodo",
          method: "POST",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.body",
        },
      },
    ]);
  });

  test("uses JSON Pointer segment boundaries when rebasing query parameter warnings", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          request: {
            query: z.object({
              id: z.string(),
              identifier: z.string().refine(value => value.startsWith("ok")),
            }),
          },
          responses: [anInlineResponseUsage(aResponseWith())],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-check",
        message:
          "Zod string check custom cannot be represented exactly in JSON Schema.",
        schemaType: "string",
        schemaPath: "/properties/identifier",
        documentPath: "/paths/~1todos/get/parameters/1/schema",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "request.query",
          parameterName: "identifier",
        },
      },
    ]);
  });
});

describe("buildOpenApiDocument response warning paths", () => {
  test("rebases schema conversion warnings for canonical component response bodies", () => {
    const warningResponse = aCanonicalOkResponse({
      name: "WarningResponse",
      body: z.object({ value: z.custom<string>() }),
    });
    const normalizedSpec = aTodoSpecWith({ responses: [warningResponse] });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-schema",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
        schemaType: "custom",
        schemaPath: "/properties/value",
        documentPath:
          "/components/schemas/WarningResponseBody/properties/value",
        location: {
          resourceName: "components.responses",
          operationId: "WarningResponse",
          openApiPath: "#/components/responses",
          part: "response.body",
          responseName: "WarningResponse",
          statusCode: "200",
        },
      },
    ]);
  });

  test("rebases component response header warnings without operation path fields", () => {
    const warningResponse = aCanonicalOkResponse({
      name: "WarningResponse",
      header: z.object({
        "x-warning": z.string().refine(value => value.startsWith("ok")),
      }),
    });
    const normalizedSpec = aTodoSpecWith({ responses: [warningResponse] });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-check",
        message:
          "Zod string check custom cannot be represented exactly in JSON Schema.",
        schemaType: "string",
        schemaPath: "/properties/x-warning",
        documentPath:
          "/components/responses/WarningResponse/headers/x-warning/schema",
        location: {
          resourceName: "components.responses",
          operationId: "WarningResponse",
          openApiPath: "#/components/responses",
          part: "response.header",
          parameterName: "x-warning",
          responseName: "WarningResponse",
          statusCode: "200",
        },
      },
    ]);
  });
});

describe("buildOpenApiDocument inline response warning paths", () => {
  test("rebases schema conversion warnings for inline response bodies", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              body: z.object({ value: z.custom<string>() }),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-schema",
        message:
          "Zod custom falls back to a broader JSON Schema representation.",
        schemaType: "custom",
        schemaPath: "/properties/value",
        documentPath:
          "/components/schemas/GetTodoOkResponseBody/properties/value",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "response.body",
          responseName: "OkResponse",
          statusCode: "200",
        },
      },
    ]);
  });

  test("rebases response header schema warnings to the specific header schema", () => {
    const normalizedSpec = aTodoSpecWith({
      operations: [
        anOperationWith({
          responses: [
            anInlineOkResponse({
              header: z.object({
                id: z.string(),
                identifier: z.string().refine(value => value.startsWith("ok")),
              }),
            }),
          ],
        }),
      ],
    });

    const result = buildOpenApiDocument(normalizedSpec, todoApiOptions());

    expect(result.warnings).toEqual([
      {
        origin: "schema-conversion",
        code: "unsupported-check",
        message:
          "Zod string check custom cannot be represented exactly in JSON Schema.",
        schemaType: "string",
        schemaPath: "/properties/identifier",
        documentPath:
          "/paths/~1todos/get/responses/200/headers/identifier/schema",
        location: {
          resourceName: "Todos",
          operationId: "getTodo",
          method: "GET",
          path: "/todos",
          openApiPath: "/todos",
          part: "response.header",
          parameterName: "identifier",
          responseName: "OkResponse",
          statusCode: "200",
        },
      },
    ]);
  });
});
