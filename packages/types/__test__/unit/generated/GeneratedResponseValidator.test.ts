import assert from "node:assert";
import { ResponseValidationError } from "@rexeus/typeweaver-core";
import {
  captureError,
  createCreateTodoSuccessResponse,
  createInternalServerErrorResponse,
  createOptionsTodoSuccessResponse,
  CreateTodoResponseValidator,
  CreateTodoSuccessResponse,
  createUnauthorizedErrorResponse,
  createValidationErrorResponse,
  InternalServerErrorResponse,
  OptionsTodoResponseValidator,
  OptionsTodoSuccessResponse,
  UnauthorizedErrorResponse,
  ValidationErrorResponse,
} from "test-utils";
import { describe, expect, test } from "vitest";

describe("Generated ResponseValidator", () => {
  describe("Status Code Validation", () => {
    test("should validate correct status codes", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const successResponse = createCreateTodoSuccessResponse();
      const errorResponse = createValidationErrorResponse();

      // Act
      const successResult = validator.safeValidate(successResponse);
      const errorResult = validator.safeValidate(errorResponse);

      // Assert
      expect(successResult.isValid).toBe(true);
      expect(errorResult.isValid).toBe(true);
      assert(successResult.isValid && errorResult.isValid);
      expect(successResult.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(successResult.data instanceof CreateTodoSuccessResponse);
      expect(errorResult.data).toBeInstanceOf(ValidationErrorResponse);
      assert(errorResult.data instanceof ValidationErrorResponse);
      expect(successResult.data.statusCode).toBe(201);
      expect(errorResult.data.statusCode).toBe(400);
    });

    test("should reject invalid status codes", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const response = createCreateTodoSuccessResponse();
      const invalidResponse = { ...response, statusCode: 418 };

      // Act & Assert
      const safeValidationResult = validator.safeValidate(invalidResponse);
      expect(safeValidationResult.isValid).toBe(false);
      assert(!safeValidationResult.isValid);
      expect(safeValidationResult.error).toBeInstanceOf(
        ResponseValidationError
      );
      expect(safeValidationResult.error.hasStatusCodeIssues()).toBe(true);
      const validateError = captureError(() =>
        validator.validate(invalidResponse)
      );
      expect(validateError).toBeInstanceOf(ResponseValidationError);
      assert(validateError instanceof ResponseValidationError);
      expect(validateError.hasStatusCodeIssues()).toBe(true);
    });
  });

  describe("Response Body Validation", () => {
    test("should validate correct response body", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const validResponse = createCreateTodoSuccessResponse();

      // Act
      const result = validator.safeValidate(validResponse);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.body.id).toBeDefined();
      expect(result.data.body.title).toBeDefined();
      expect(result.data.body.status).toBeDefined();
    });

    test("should reject invalid response body", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const invalidResponse = createCreateTodoSuccessResponse({
        body: {
          id: 123 as any, // Should be string ULID
          title: null as any, // Should be string
          status: "INVALID_STATUS" as any, // Should be valid enum
        },
      });

      // Act
      const result = validator.safeValidate(invalidResponse);

      // Assert
      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error).toBeInstanceOf(ResponseValidationError);
      assert(result.error instanceof ResponseValidationError);
      expect(result.error.hasIssues()).toBe(true);
      expect(result.error.issues).toHaveLength(1);
      expect(
        result.error.getResponseBodyIssues("CreateTodoSuccess")
      ).toHaveLength(3);
    });

    test("should strip additional fields from response body", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const responseWithExtraFields = createCreateTodoSuccessResponse({
        body: {
          title: "Custom title", // Valid field that should be preserved
          // Note: Extra fields are added by the factory but stripped by validation
        } as any,
      });

      // Act
      const result = validator.safeValidate(responseWithExtraFields);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.body.title).toBe("Custom title");
      expect(result.data.body).not.toHaveProperty("extraField");
      expect(result.data.body).not.toHaveProperty("anotherExtraField");
    });
  });

  describe("Response Header Validation", () => {
    test("should validate correct response headers", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const validResponse = createCreateTodoSuccessResponse();

      // Act
      const result = validator.safeValidate(validResponse);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.header["Content-Type"]).toBe("application/json");
    });

    test("should reject invalid response headers", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const invalidHeaderResponse = createCreateTodoSuccessResponse({
        header: {
          "Content-Type": "invalid/content-type" as any,
        },
      });

      // Act
      const invalidResult = validator.safeValidate(invalidHeaderResponse);

      // Assert
      expect(invalidResult.isValid).toBe(false);
      assert(!invalidResult.isValid);
      expect(invalidResult.error).toBeInstanceOf(ResponseValidationError);
      assert(invalidResult.error instanceof ResponseValidationError);
      expect(invalidResult.error.issues).toHaveLength(1);
      expect(
        invalidResult.error.getResponseHeaderIssues("CreateTodoSuccess")
      ).toHaveLength(1);
    });

    test("should strip additional fields from response headers", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const responseWithExtraHeaders = createCreateTodoSuccessResponse({
        header: {
          "Content-Type": "application/json", // Required field that should be preserved
          // Note: Extra headers are added by factory but stripped by validation
        } as any,
      });

      // Act
      const result = validator.safeValidate(responseWithExtraHeaders);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.header["Content-Type"]).toBe("application/json");
      expect(result.data.header).not.toHaveProperty("X-Custom-Header");
      expect(result.data.header).not.toHaveProperty("X-Another-Header");
    });

    test("should coerce response header keys to match schema case-insensitively", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const responseWithMixedCaseHeaders = createCreateTodoSuccessResponse({
        header: {
          // @ts-expect-error Wrong casing for testing
          "CONTENT-TYPE": "application/json",
          "x-multi-value": ["my-value"],
        },
      });
      // Remove the headers in correct casing to test coercion
      delete (responseWithMixedCaseHeaders.header as any)["Content-Type"];
      delete (responseWithMixedCaseHeaders.header as any)["X-Multi-Value"];

      // Act
      const result = validator.safeValidate(responseWithMixedCaseHeaders);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.header["Content-Type"]).toBe("application/json");
      expect(result.data.header["X-Multi-Value"]).toEqual(["my-value"]);
      expect(result.data.header).not.toHaveProperty("CONTENT-TYPE");
      expect(result.data.header).not.toHaveProperty("x-multi-value");
    });

    test("should split comma-separated response header string into array when schema expects array", () => {
      // Arrange
      const validator = new OptionsTodoResponseValidator();
      const response = createOptionsTodoSuccessResponse();
      // Simulate what Headers.forEach delivers: comma-joined string
      (response as any).header = {
        Allow: "GET, POST, OPTIONS",
      };

      // Act
      const result = validator.safeValidate(response);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(OptionsTodoSuccessResponse);
      assert(result.data instanceof OptionsTodoSuccessResponse);
      expect(result.data.header.Allow).toEqual(["GET", "POST", "OPTIONS"]);
    });

    test("should preserve falsy string '0' in comma-split header values", () => {
      // Arrange
      const validator = new OptionsTodoResponseValidator();
      const response = createOptionsTodoSuccessResponse();
      (response as any).header = {
        Allow: "0, 1, 2",
      };

      // Act
      const result = validator.safeValidate(response);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(OptionsTodoSuccessResponse);
      assert(result.data instanceof OptionsTodoSuccessResponse);
      expect(result.data.header.Allow).toEqual(["0", "1", "2"]);
    });

    test("should not split comma in non-array response header field", () => {
      // Arrange
      const validator = new OptionsTodoResponseValidator();
      const response = createOptionsTodoSuccessResponse();
      (response as any).header = {
        ...response.header,
        "Access-Control-Allow-Origin": "https://foo.com, https://bar.com",
      };

      // Act
      const result = validator.safeValidate(response);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(OptionsTodoSuccessResponse);
      assert(result.data instanceof OptionsTodoSuccessResponse);
      expect(result.data.header["Access-Control-Allow-Origin"]).toBe(
        "https://foo.com, https://bar.com"
      );
    });

    test("should split comma-separated response header without spaces", () => {
      // Arrange
      const validator = new OptionsTodoResponseValidator();
      const response = createOptionsTodoSuccessResponse();
      (response as any).header = {
        Allow: "GET,POST,OPTIONS",
      };

      // Act
      const result = validator.safeValidate(response);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(OptionsTodoSuccessResponse);
      assert(result.data instanceof OptionsTodoSuccessResponse);
      expect(result.data.header.Allow).toEqual(["GET", "POST", "OPTIONS"]);
    });

    test("should not re-split response header value that is already an array", () => {
      // Arrange
      const validator = new OptionsTodoResponseValidator();
      const response = createOptionsTodoSuccessResponse();

      // Act — factory already produces arrays, validate they pass through unchanged
      const result = validator.safeValidate(response);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(OptionsTodoSuccessResponse);
      assert(result.data instanceof OptionsTodoSuccessResponse);
      expect(result.data.header.Allow).toEqual([
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
      ]);
    });

    test("should coerce single response header value to array when schema expects array", () => {
      const validator = new CreateTodoResponseValidator();
      const validResponse = createCreateTodoSuccessResponse({
        header: {
          "X-Multi-Value": "my-value" as any, // Schema expects array, provide single value
        },
      });

      // Act
      const result = validator.safeValidate(validResponse);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.header["X-Multi-Value"]).toEqual(["my-value"]);
    });

    test("should coerce array response header value to single when schema expects single", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const responseWithArrayHeaders = createCreateTodoSuccessResponse({
        header: {
          "Content-Type": ["application/json"] as any, // Schema expects single string, provide array
        },
      });

      // Act
      const result = validator.safeValidate(responseWithArrayHeaders);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.header["Content-Type"]).toBe("application/json");
    });
  });

  describe("Operation Response Types", () => {
    test("should validate success response", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const successResponse = createCreateTodoSuccessResponse();

      // Act
      const result = validator.safeValidate(successResponse);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.statusCode).toBe(201);
      expect(result.data.body.id).toBeDefined();
      expect(result.data.body.title).toBeDefined();
    });

    test("should validate shared error responses", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const validationError = createValidationErrorResponse();
      const unauthorizedError = createUnauthorizedErrorResponse();
      const internalError = createInternalServerErrorResponse();

      // Act
      const validationResult = validator.safeValidate(validationError);
      const unauthorizedResult = validator.safeValidate(unauthorizedError);
      const internalResult = validator.safeValidate(internalError);

      // Assert
      expect(validationResult.isValid).toBe(true);
      expect(unauthorizedResult.isValid).toBe(true);
      expect(internalResult.isValid).toBe(true);
      assert(
        validationResult.isValid &&
          unauthorizedResult.isValid &&
          internalResult.isValid
      );
      expect(validationResult.data).toBeInstanceOf(ValidationErrorResponse);
      assert(validationResult.data instanceof ValidationErrorResponse);
      expect(unauthorizedResult.data).toBeInstanceOf(UnauthorizedErrorResponse);
      assert(unauthorizedResult.data instanceof UnauthorizedErrorResponse);
      expect(internalResult.data).toBeInstanceOf(InternalServerErrorResponse);
      assert(internalResult.data instanceof InternalServerErrorResponse);
      expect(validationResult.data.statusCode).toBe(400);
      expect(unauthorizedResult.data.statusCode).toBe(401);
      expect(internalResult.data.statusCode).toBe(500);
    });

    test("should validate operation-specific success response", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const successResponse = createCreateTodoSuccessResponse();

      // Act
      const result = validator.safeValidate(successResponse);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.statusCode).toBe(201);
      expect(result.data.body.id).toBeDefined();
      expect(result.data.body.title).toBeDefined();
    });
  });

  describe("Cross-Component Validation", () => {
    test("should accumulate multiple validation errors", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const invalidResponse = createCreateTodoSuccessResponse({
        header: {
          "Content-Type": "invalid/content-type" as any, // Invalid header
        },
        body: {
          id: 123 as any, // Invalid body - should be string
          title: null as any, // Invalid body - should be string
        },
      });

      // Act
      const result = validator.safeValidate(invalidResponse);

      // Assert
      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error).toBeInstanceOf(ResponseValidationError);
      assert(result.error instanceof ResponseValidationError);
      expect(result.error.hasIssues()).toBe(true);
      expect(result.error.issues).toHaveLength(1);
      expect(
        result.error.getResponseHeaderIssues("CreateTodoSuccess")
      ).toHaveLength(1);
      expect(
        result.error.getResponseBodyIssues("CreateTodoSuccess")
      ).toHaveLength(2);
    });

    test("should strip additional fields across all components", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const responseWithValidFields = createCreateTodoSuccessResponse({
        header: {
          "Content-Type": "application/json", // Required field that should be preserved
        } as any,
        body: {
          title: "Custom title", // Valid field that should be preserved
          // Note: Extra fields added by factory but stripped by validation
        } as any,
      });

      // Act
      const result = validator.safeValidate(responseWithValidFields);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(result.data instanceof CreateTodoSuccessResponse);
      expect(result.data.header["Content-Type"]).toBe("application/json");
      expect(result.data.header).not.toHaveProperty("X-Extra-Header");
      expect(result.data.body.title).toBe("Custom title");
      expect(result.data.body).not.toHaveProperty("extraBodyField");
      expect(result.data.body).not.toHaveProperty("anotherBodyField");
    });
  });

  describe("Method Variants", () => {
    test("both methods should return consistent results on success", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const validResponse = createCreateTodoSuccessResponse();

      // Act
      const safeResult = validator.safeValidate(validResponse);
      const directResult = validator.validate(validResponse);

      // Assert
      expect(safeResult.isValid).toBe(true);
      assert(safeResult.isValid);
      expect(safeResult.data).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(safeResult.data instanceof CreateTodoSuccessResponse);
      expect(directResult).toBeInstanceOf(CreateTodoSuccessResponse);
      assert(directResult instanceof CreateTodoSuccessResponse);
      expect(safeResult.data).toEqual(directResult);
    });

    test("both methods should return consistent results on failure", () => {
      // Arrange
      const validator = new CreateTodoResponseValidator();
      const invalidResponse = createCreateTodoSuccessResponse({
        body: {
          id: 123 as any, // Invalid type
        },
      });

      // Act
      const safeResult = validator.safeValidate(invalidResponse);
      const thrownError = captureError<ResponseValidationError>(() =>
        validator.validate(invalidResponse)
      );

      // Assert
      expect(safeResult.isValid).toBe(false);
      assert(!safeResult.isValid);
      expect(thrownError).toBeDefined();
      expect(safeResult.error).toBeInstanceOf(ResponseValidationError);
      expect(thrownError).toBeInstanceOf(ResponseValidationError);
      expect(safeResult.error.hasIssues()).toBe(true);
      expect(thrownError?.hasIssues()).toBe(true);
      expect(safeResult.error.issues).toEqual(thrownError?.issues);
    });
  });
});
