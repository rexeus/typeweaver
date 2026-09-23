import assert from "node:assert";
import {
  HttpStatusCode,
  ResponseValidationError,
} from "@rexeus/typeweaver-core";
import type { IResponseValidator } from "@rexeus/typeweaver-core";
import {
  captureError,
  CreateTodoResponseValidator,
  DeleteTodoResponseValidator,
  OptionsTodoResponseValidator,
} from "test-utils";
import { describe, expect, expectTypeOf, test } from "vitest";
import {
  expectNoPartialData,
  issuePaths,
  responseIssueFor,
  responseWithRuntimePart,
  safeValidateRaw,
  validateRaw,
  validCreateTodoBody,
  validCreateTodoHeader,
  validCreateTodoResponse,
} from "./fixtures.js";
import type {
  CreateTodoResponse,
  DeleteTodoResponse,
  OptionsTodoResponse,
} from "test-utils";

describe("Generated ResponseValidator safe and throwing contracts", () => {
  test("normalizes a valid response through the safe path", () => {
    const validator = new CreateTodoResponseValidator();
    const response = validCreateTodoResponse();

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data).toEqual({
      type: "CreateTodoSuccess",
      statusCode: HttpStatusCode.CREATED,
      header: validCreateTodoHeader(),
      body: validCreateTodoBody(),
    });
  });

  test("returns the same normalized data from the throwing path", () => {
    const validator = new CreateTodoResponseValidator();
    const response = validCreateTodoResponse();

    const safeResult = safeValidateRaw(validator, response);
    const validated = validateRaw(validator, response);

    expect(safeResult.isValid).toBe(true);
    assert(safeResult.isValid);
    expect(validated).toEqual(safeResult.data);
  });

  test("returns a failure for an invalid body field without throwing or exposing partial data", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "body",
      {
        ...validCreateTodoBody(),
        id: 123,
      }
    );

    const result = safeValidateRaw(validator, response);

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(result.error).toBeInstanceOf(ResponseValidationError);
    expect(
      issuePaths(result.error.getResponseBodyIssues("CreateTodoSuccess"))
    ).toEqual(["id"]);
  });

  test("throws a response validation error with the same issues as the safe path", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "body",
      {
        ...validCreateTodoBody(),
        status: "BLOCKED",
      }
    );

    const safeResult = safeValidateRaw(validator, response);
    const thrownError = captureError<ResponseValidationError>(() =>
      validateRaw(validator, response)
    );

    expect(safeResult.isValid).toBe(false);
    assert(!safeResult.isValid);
    expect(thrownError).toBeInstanceOf(ResponseValidationError);
    expect(thrownError?.issues).toEqual(safeResult.error.issues);
  });
});

describe("Generated ResponseValidator generic response contracts", () => {
  test("assigns generated validators to the generic response validator contract", () => {
    const createValidator: IResponseValidator<CreateTodoResponse> =
      new CreateTodoResponseValidator();
    const deleteValidator: IResponseValidator<DeleteTodoResponse> =
      new DeleteTodoResponseValidator();
    const optionsValidator: IResponseValidator<OptionsTodoResponse> =
      new OptionsTodoResponseValidator();

    expectTypeOf(createValidator).toMatchTypeOf<
      IResponseValidator<CreateTodoResponse>
    >();
    expectTypeOf(deleteValidator).toMatchTypeOf<
      IResponseValidator<DeleteTodoResponse>
    >();
    expectTypeOf(optionsValidator).toMatchTypeOf<
      IResponseValidator<OptionsTodoResponse>
    >();
  });

  test("preserves CreateTodo response types through safe and throwing generic validation", () => {
    const createValidator: IResponseValidator<CreateTodoResponse> =
      new CreateTodoResponseValidator();

    const safeResult = safeValidateRaw(
      createValidator,
      validCreateTodoResponse()
    );
    const validated = validateRaw(createValidator, validCreateTodoResponse());

    expect(safeResult.isValid).toBe(true);
    assert(safeResult.isValid);
    expectTypeOf(safeResult.data).toEqualTypeOf<CreateTodoResponse>();
    expectTypeOf(validated).toEqualTypeOf<CreateTodoResponse>();
  });
});

describe("Generated ResponseValidator accumulated errors", () => {
  test("groups invalid body and header issues under the matching response name", () => {
    const validator = new CreateTodoResponseValidator();
    const response = {
      ...validCreateTodoResponse(),
      header: {
        ...validCreateTodoHeader(),
        "Content-Type": "text/plain",
      },
      body: {
        ...validCreateTodoBody(),
        id: 123,
        status: "BLOCKED",
      },
    };

    const result = safeValidateRaw(validator, response);

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(result.error.issues).toHaveLength(1);
    expect(responseIssueFor(result.error, "CreateTodoSuccess")).toMatchObject({
      type: "INVALID_RESPONSE",
      responseName: "CreateTodoSuccess",
    });
    expect(
      issuePaths(result.error.getResponseHeaderIssues("CreateTodoSuccess"))
    ).toEqual(["Content-Type"]);
    expect(
      issuePaths(result.error.getResponseBodyIssues("CreateTodoSuccess"))
    ).toEqual(["id", "status"]);
  });

  test("reports only a status-code issue when the status code is invalid", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "statusCode",
      418
    );

    const result = safeValidateRaw(validator, response);

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0]?.type).toBe("INVALID_STATUS_CODE");
    expect(result.error.hasResponseIssues()).toBe(false);
  });
});
