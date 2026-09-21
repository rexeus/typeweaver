import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  componentResponseSchemaAt,
  componentsSchemas,
  expectContractProjection,
  expectMetricBoundaryProjection,
  requestBodySchemaAt,
  responseSchemaAt,
} from "./generatedOpenApiFixture.document.js";
import { assertFixtureExists } from "./generatedOpenApiFixture.validation.js";
import type { OpenApiFixture } from "./generatedOpenApiFixture.document.js";

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../test-utils/src/test-project/output/openapi/openapi.json"
);

describe("generated OpenAPI document contract", () => {
  test("validates the committed test-utils fixture as an OpenAPI document", async () => {
    assertFixtureExists(FIXTURE_PATH);
    const fixture = JSON.parse(
      readFileSync(FIXTURE_PATH, "utf8")
    ) as OpenApiFixture;

    expect(fixture.openapi).toBe("3.1.2");
    expectContractProjection(fixture);
    expectMetricBoundaryProjection(fixture);
    const schemas = componentsSchemas(fixture);

    expect(
      requestBodySchemaAt(fixture, "/todos/{todoId}/status", "put"),
      "UpdateTodoStatus request body should reference a component schema"
    ).toEqual({ $ref: "#/components/schemas/UpdateTodoStatusRequestBody" });
    expect(
      schemas["UpdateTodoStatusRequestBody"],
      "UpdateTodoStatusRequestBody component should exist for the request body ref"
    ).toEqual({
      type: "object",
      properties: {
        value: {
          type: "string",
          enum: ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"],
        },
      },
      required: ["value"],
      additionalProperties: false,
    });
    expect(
      responseSchemaAt(fixture, {
        path: "/todos/{todoId}/status",
        method: "put",
        statusCode: "409",
      }),
      "UpdateTodoStatus 409 should merge duplicate-status bodies as anyOf refs"
    ).toEqual({
      anyOf: [
        { $ref: "#/components/schemas/TodoStatusTransitionInvalidErrorBody" },
        { $ref: "#/components/schemas/TodoNotChangeableErrorBody" },
      ],
    });
    expect(
      schemas["TodoStatusTransitionInvalidErrorBody"],
      "TodoStatusTransitionInvalidErrorBody component should exist for the 409 anyOf ref"
    ).toMatchObject({
      type: "object",
      properties: {
        message: {
          type: "string",
          enum: ["Todo status transition is conflicting with current status"],
        },
        code: {
          type: "string",
          enum: ["TODO_STATUS_TRANSITION_INVALID_ERROR"],
        },
      },
    });
    expect(
      schemas["TodoNotChangeableErrorBody"],
      "TodoNotChangeableErrorBody component should exist for the 409 anyOf ref"
    ).toMatchObject({
      type: "object",
      properties: {
        message: {
          type: "string",
          enum: ["Todo in current status cannot be changed"],
        },
        code: { type: "string", enum: ["TODO_NOT_CHANGEABLE_ERROR"] },
      },
    });
    expect(
      componentResponseSchemaAt(
        fixture,
        "DownloadFileContentSuccess",
        "application/octet-stream"
      ),
      "DownloadFileContent 200 should expose an octet-stream binary response"
    ).toEqual({ type: "string", format: "binary" });
  }, 30_000);
});
