import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { createCreateTodoRequest, createTestApp } from "test-utils";
import { describe, expect, test } from "vitest";
import {
  BASE_URL,
  buildCreateTodoSuccess,
  buildFetchRequest,
  expectJson,
} from "../../../helpers.js";

describe("Response Validation disabled", () => {
  test("should pass through extra body fields when validation is disabled", async () => {
    const responseWithExtra = buildCreateTodoSuccess({
      extraField: "should-remain",
      secretData: { nested: true },
    });
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: responseWithExtra,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data["extraField"]).toBe("should-remain");
    expect(data["secretData"]).toEqual({ nested: true });
  });

  test("should pass through invalid response types when validation is disabled", async () => {
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: { "Content-Type": "application/json" },
      body: { id: 12345, title: true },
    };
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: invalidResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data["id"]).toBe(12345);
    expect(data["title"]).toBe(true);
  });

  test("should omit undefined header values from thrown typed responses when validation is disabled", async () => {
    const thrownResponse: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: { "X-Single-Value": undefined },
    };
    const app = createTestApp({
      validateResponses: false,
      throwTodoError: thrownResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data).toEqual(thrownResponse.body);
    expect(response.headers.get("x-single-value")).toBeNull();
  });
});

describe("Response Validation pass-through mode", () => {
  test("should return the invalid response as-is when handleResponseValidationErrors is false", async () => {
    const invalidResponse: ITypedHttpResponse = {
      type: "CreateTodoSuccess" as const,
      statusCode: 201,
      header: { "Content-Type": "application/json" },
      body: {
        id: 12345,
        title: true,
      },
    };
    const app = createTestApp({
      validateResponses: true,
      handleResponseValidationErrors: false,
      throwTodoError: invalidResponse,
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data).toEqual({ id: 12345, title: true });
  });

  test("should still strip extra fields from valid responses when handleResponseValidationErrors is false", async () => {
    const app = createTestApp({
      validateResponses: true,
      handleResponseValidationErrors: false,
      throwTodoError: buildCreateTodoSuccess({ extraField: "should-strip" }),
    });
    const requestData = createCreateTodoRequest();

    const response = await app.fetch(
      buildFetchRequest(`${BASE_URL}/todos`, requestData)
    );

    const data = await expectJson(response, 201);
    expect(data).not.toHaveProperty("extraField");
    expect(data["id"]).toBeDefined();
    expect(data["title"]).toBeDefined();
  });
});
