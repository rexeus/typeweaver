import { describe, test, expect } from "vitest";
import { RequestValidationError } from "@rexeus/typeweaver-core";
import {
  createTodoRequest,
  createGetTodoRequest,
  createListTodosRequest,
  createQuerySubTodoRequest,
  CreateTodoRequestValidator,
  GetTodoRequestValidator,
  ListTodosRequestValidator,
  QuerySubTodoRequestValidator,
  captureError,
} from "test-utils";
import assert from "assert";

describe("GeneratedRequestValidator", () => {
  describe("Body Validation", () => {
    test("should validate correct body schema", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const validRequest = createTodoRequest();

      // Act
      const result = validator.safeValidate(validRequest);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.body).toEqual(validRequest.body);
    });

    test("should reject invalid body schema", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const invalidRequest = createTodoRequest({
        body: {
          title: 123 as any, // Should be a string
        },
      });

      // Act
      const result = validator.safeValidate(invalidRequest);

      // Assert
      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error.hasIssues()).toBe(true);
      expect(result.error.bodyIssues).toHaveLength(1);
    });
  });

  describe("Header Validation", () => {
    test("should validate correct headers", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const validRequest = createTodoRequest();

      // Act
      const result = validator.safeValidate(validRequest);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.header).toEqual(validRequest.header);
    });

    test("should reject invalid headers", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const invalidRequest = createTodoRequest({
        header: {
          Accept: "invalid/accept-type" as any, // Invalid Accept header
        },
      });

      // Act
      const result = validator.safeValidate(invalidRequest);

      // Assert
      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error.hasIssues()).toBe(true);
      expect(result.error.headerIssues).toHaveLength(1);
    });
  });

  describe("Path Parameter Validation", () => {
    test("should validate correct path parameters", () => {
      // Arrange
      const validator = new GetTodoRequestValidator();
      const validRequest = createGetTodoRequest();

      // Act
      const result = validator.safeValidate(validRequest);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.param).toEqual(validRequest.param);
    });

    test("should reject invalid path parameters", () => {
      // Arrange
      const validator = new GetTodoRequestValidator();
      const invalidRequest = createGetTodoRequest({
        param: {
          todoId: "invalid-ulid-format" as any, // Invalid ULID format
        },
      });

      // Act
      const result = validator.safeValidate(invalidRequest);

      // Assert
      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error.hasIssues()).toBe(true);
      expect(result.error.pathParamIssues).toHaveLength(1);
    });
  });

  describe("Query Parameter Validation", () => {
    test("should validate correct query parameters", () => {
      // Arrange
      const validator = new ListTodosRequestValidator();
      const validRequest = createListTodosRequest();

      // Act
      const result = validator.safeValidate(validRequest);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.query).toEqual(validRequest.query);
    });

    test("should reject invalid query parameters", () => {
      // Arrange
      const validator = new ListTodosRequestValidator();
      const invalidRequest = createListTodosRequest({
        query: {
          status: "INVALID_STATUS" as any,
        },
      });

      // Act
      const result = validator.safeValidate(invalidRequest);

      // Assert
      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error.hasIssues()).toBe(true);
      expect(result.error.queryIssues).toHaveLength(1);
    });
  });

  describe("Cross-Component Validation", () => {
    test("should accumulate multiple validation errors", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const invalidRequest = createTodoRequest({
        body: {
          title: 123 as any, // Invalid body
        },
        header: {
          Accept: "invalid/accept-type" as any,
        },
      });

      // Act
      const result = validator.safeValidate(invalidRequest);

      // Assert
      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error.hasIssues()).toBe(true);
      expect(result.error.bodyIssues).toHaveLength(1);
      expect(result.error.headerIssues).toHaveLength(1);
    });

    test("should accumulate errors across all components", () => {
      // Arrange
      const validator = new QuerySubTodoRequestValidator();
      const invalidRequest = createQuerySubTodoRequest({
        header: {
          Accept: "invalid/accept-type" as any,
        },
        param: {
          todoId: "invalid-ulid-format" as any,
        },
        query: {
          sortBy: "invalid_sort" as any,
        },
        body: {
          status: "INVALID_STATUS" as any,
        },
      });

      // Act
      const result = validator.safeValidate(invalidRequest);

      // Assert
      expect(result.isValid).toBe(false);
      assert(!result.isValid);
      expect(result.error.hasIssues()).toBe(true);
      expect(result.error.headerIssues).toHaveLength(1);
      expect(result.error.pathParamIssues).toHaveLength(1);
      expect(result.error.queryIssues).toHaveLength(1);
      expect(result.error.bodyIssues).toHaveLength(1);
    });
  });

  describe("Method Variants", () => {
    test("both methods should return consistent results on success", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const validRequest = createTodoRequest();

      // Act
      const safeResult = validator.safeValidate(validRequest);
      const directResult = validator.validate(validRequest);

      // Assert
      expect(safeResult.isValid).toBe(true);
      assert(safeResult.isValid);
      expect(safeResult.data).toEqual(directResult);
    });

    test("both methods should return consistent results on failure", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const invalidRequest = createTodoRequest({
        body: {
          title: 123 as any,
        },
      });

      // Act
      const safeResult = validator.safeValidate(invalidRequest);
      const thrownError = captureError<RequestValidationError>(() =>
        validator.validate(invalidRequest)
      );

      // Assert
      expect(safeResult.isValid).toBe(false);
      assert(!safeResult.isValid);
      expect(thrownError).toBeDefined();
      expect(safeResult.error.hasIssues()).toBe(true);
      expect(thrownError?.hasIssues()).toBe(true);
      expect(safeResult.error.bodyIssues).toEqual(thrownError?.bodyIssues);
    });
  });
});
