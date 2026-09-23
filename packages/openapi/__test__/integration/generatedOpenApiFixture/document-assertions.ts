import { expect } from "vitest";
import { isRecord } from "./fixtures.js";
import type { OpenApiFixture } from "./fixtures.js";

export function expectContractProjection(fixture: OpenApiFixture): void {
  expect(fixture).toMatchObject({
    info: {
      title: "TypeWeaver Test API",
      version: "1.0.0",
      description:
        "Executable fixture for metadata, security, transport, and generator contracts.",
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/todos/{todoId}": {
        get: {
          description:
            "Returns one todo using an AND-combined bearer and API-key requirement.",
          tags: ["todos", "read"],
          security: [{ bearerAuth: [], apiKeyAuth: [] }],
        },
        options: {
          deprecated: true,
          security: [],
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
        apiKeyAuth: {
          type: "apiKey",
          name: "X-API-Key",
          in: "header",
        },
        oauth2Auth: {
          type: "oauth2",
          flows: {
            authorizationCode: {
              authorizationUrl: "https://identity.example.test/authorize",
              tokenUrl: "https://identity.example.test/token",
              scopes: {
                "tokens:write": "Create and refresh access tokens",
              },
            },
          },
        },
      },
    },
  });
}

export function expectMetricBoundaryProjection(fixture: OpenApiFixture): void {
  expect(parametersAt(fixture, "/metrics/{metricId}", "get")).toEqual([
    {
      name: "metricId",
      in: "path",
      required: true,
      schema: {
        type: "integer",
        exclusiveMinimum: 0,
        maximum: Number.MAX_SAFE_INTEGER,
      },
    },
    {
      name: "enabled",
      in: "query",
      required: false,
      schema: { type: "boolean" },
    },
    {
      name: "truthy",
      in: "query",
      required: false,
      schema: { type: "boolean" },
    },
    {
      name: "capturedAt",
      in: "query",
      required: false,
      schema: {},
    },
    {
      name: "samples",
      in: "query",
      required: false,
      schema: { type: "array", items: { type: "number" } },
    },
    {
      name: "X-Attempt",
      in: "header",
      required: true,
      schema: {
        type: "integer",
        minimum: Number.MIN_SAFE_INTEGER,
        maximum: Number.MAX_SAFE_INTEGER,
      },
    },
    {
      name: "X-Enabled",
      in: "header",
      required: false,
      schema: { type: "boolean" },
    },
    {
      name: "X-Flags",
      in: "header",
      required: false,
      schema: { type: "array", items: { type: "boolean" } },
    },
    {
      name: "X-Note",
      in: "header",
      required: false,
      schema: { type: "string" },
    },
    {
      name: "X-Observed-At",
      in: "header",
      required: false,
      schema: {},
    },
  ]);
}

export function parametersAt(
  fixture: OpenApiFixture,
  path: string,
  method: string
): readonly unknown[] | undefined {
  if (!isRecord(fixture.paths)) {
    return undefined;
  }

  const pathItem = fixture.paths[path];
  if (!isRecord(pathItem)) {
    return undefined;
  }

  const operation = pathItem[method];
  if (!isRecord(operation) || !Array.isArray(operation["parameters"])) {
    return undefined;
  }

  return operation["parameters"] as readonly unknown[];
}

export function componentsSchemas(
  fixture: OpenApiFixture
): Record<string, unknown> {
  if (!isRecord(fixture.components)) {
    throw new Error("Fixture is missing components.");
  }

  const schemas = fixture.components["schemas"];

  if (!isRecord(schemas) || Object.keys(schemas).length === 0) {
    throw new Error("Fixture is missing non-empty components.schemas.");
  }

  return schemas;
}

export function requestBodySchemaAt(
  fixture: OpenApiFixture,
  path: string,
  method: string
): unknown {
  if (!isRecord(fixture.paths)) {
    return undefined;
  }

  const pathItem = fixture.paths[path];
  if (!isRecord(pathItem)) {
    return undefined;
  }

  const operation = pathItem[method];
  if (!isRecord(operation) || !isRecord(operation["requestBody"])) {
    return undefined;
  }

  const requestBody = operation["requestBody"];
  if (!isRecord(requestBody["content"])) {
    return undefined;
  }

  const mediaType = requestBody["content"]["application/json"];

  return isRecord(mediaType) ? mediaType["schema"] : undefined;
}

export function responseSchemaAt(
  fixture: OpenApiFixture,
  location: {
    readonly path: string;
    readonly method: string;
    readonly statusCode: string;
    readonly mediaTypeName?: string;
  }
): unknown {
  if (!isRecord(fixture.paths)) {
    return undefined;
  }

  const pathItem = fixture.paths[location.path];
  if (!isRecord(pathItem)) {
    return undefined;
  }

  const operation = pathItem[location.method];
  if (!isRecord(operation) || !isRecord(operation["responses"])) {
    return undefined;
  }

  const response = operation["responses"][location.statusCode];
  if (!isRecord(response) || !isRecord(response["content"])) {
    return undefined;
  }

  const mediaType =
    response["content"][location.mediaTypeName ?? "application/json"];

  return isRecord(mediaType) ? mediaType["schema"] : undefined;
}

export function componentResponseSchemaAt(
  fixture: OpenApiFixture,
  responseName: string,
  mediaTypeName = "application/json"
): unknown {
  if (!isRecord(fixture.components)) {
    return undefined;
  }

  const responses = fixture.components["responses"];
  if (!isRecord(responses)) {
    return undefined;
  }

  const response = responses[responseName];
  if (!isRecord(response) || !isRecord(response["content"])) {
    return undefined;
  }

  const mediaType = response["content"][mediaTypeName];

  return isRecord(mediaType) ? mediaType["schema"] : undefined;
}
