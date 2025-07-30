import { describe, test, expect } from "vitest";
import { ResponseValidationError } from "@rexeus/typeweaver-core";
import {
  CreateTodoResponseValidator,
  createCreateTodoSuccessResponse,
  createValidationErrorResponse,
  createUnauthorizedErrorResponse,
  createInternalServerErrorResponse,
  captureError,
  ValidationErrorResponse,
  CreateTodoSuccessResponse,
  UnauthorizedErrorResponse,
  InternalServerErrorResponse,
} from "test-utils";
import assert from "assert";

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
      expect(() => validator.safeValidate(invalidResponse)).toThrow(
        "Invalid response status code"
      );
      expect(() => validator.validate(invalidResponse)).toThrow(
        "Invalid response status code"
      );
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
      expect(result.error.bodyIssues).toHaveLength(3);
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
      expect(invalidResult.error.headerIssues).toHaveLength(1);
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
      expect(result.error.headerIssues).toHaveLength(1);
      expect(result.error.bodyIssues).toHaveLength(2);
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
      expect(safeResult.error.bodyIssues).toEqual(thrownError?.bodyIssues);
    });
  });
});
