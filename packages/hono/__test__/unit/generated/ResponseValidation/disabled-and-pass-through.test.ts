import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  aCreateTodoSuccessResponseWithBody,
  buildCreateTodoSuccess,
} from "../../../helpers.js";
import {
  createCreateTodoRouteReturning,
  expectJson,
  requestCreateTodo,
} from "./fixtures.js";

describe("validateResponses: false", () => {
  test("passes through extra body fields when response validation is disabled", async () => {
    const responseWithExtra = buildCreateTodoSuccess({
      extraField: "should-remain",
      secretData: { nested: true },
    });
    const app = createCreateTodoRouteReturning(responseWithExtra, {
      validateResponses: false,
    });

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data["extraField"]).toBe("should-remain");
    expect(data["secretData"]).toEqual({ nested: true });
  });

  test("passes through schema-invalid body values when response validation is disabled", async () => {
    const invalidResponse = aCreateTodoSuccessResponseWithBody({
      id: 12345,
      title: true,
    });
    const app = createCreateTodoRouteReturning(invalidResponse, {
      validateResponses: false,
    });

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data["id"]).toBe(12345);
    expect(data["title"]).toBe(true);
  });

  test("keeps unknown response headers when response validation is disabled", async () => {
    const responseWithUnknownHeader: ITypedHttpResponse = {
      ...buildCreateTodoSuccess(),
      header: {
        "Content-Type": "application/json",
        "X-Trace-Id": "trace-1",
      },
    };
    const app = createCreateTodoRouteReturning(responseWithUnknownHeader, {
      validateResponses: false,
    });

    const response = await requestCreateTodo(app);

    await expectJson(response, 201);
    expect(response.headers.get("x-trace-id")).toBe("trace-1");
  });
});

describe("handleResponseValidationErrors: false", () => {
  test("returns invalid responses as-is when response-validation handling is disabled", async () => {
    const invalidResponse = aCreateTodoSuccessResponseWithBody({
      id: 12345,
      title: true,
    });
    const app = createCreateTodoRouteReturning(invalidResponse, {
      validateResponses: true,
      handleResponseValidationErrors: false,
    });

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data["id"]).toBe(12345);
    expect(data["title"]).toBe(true);
  });

  test("still strips extra fields from valid responses when response-validation error handling is disabled", async () => {
    const responseWithExtra = buildCreateTodoSuccess({
      extraField: "should-strip",
    });
    const app = createCreateTodoRouteReturning(responseWithExtra, {
      validateResponses: true,
      handleResponseValidationErrors: false,
    });

    const response = await requestCreateTodo(app);

    const data = await expectJson(response, 201);
    expect(data).not.toHaveProperty("extraField");
    expect(data["id"]).toBe(responseWithExtra.body.id);
    expect(data["title"]).toBe(responseWithExtra.body.title);
  });
});
