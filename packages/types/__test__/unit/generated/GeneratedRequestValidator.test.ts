import { describe, test, expect } from "vitest";
import { RequestValidationError } from "@rexeus/typeweaver-core";
import {
  createCreateTodoRequest,
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
      const validRequest = createCreateTodoRequest();

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
      const invalidRequest = createCreateTodoRequest({
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

    test("should strip additional fields from request body", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const requestWithExtraFields = createCreateTodoRequest({
        body: {
          title: "Valid title",
          description: "Valid description",
          extraField: "should be stripped",
          anotherExtraField: 123,
        } as any,
      });

      // Act
      const result = validator.safeValidate(requestWithExtraFields);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.body).not.toHaveProperty("extraField");
      expect(result.data.body).not.toHaveProperty("anotherExtraField");
    });
  });

  describe("Header Validation", () => {
    test("should validate correct headers", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const validRequest = createCreateTodoRequest();

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
      const invalidRequest = createCreateTodoRequest({
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

    test("should strip additional fields from request headers", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const requestWithExtraHeaders = createCreateTodoRequest({
        header: {
          Accept: "application/json",
          "Extra-Header": "should be stripped",
          "Another-Extra": "also stripped",
        } as any,
      });

      // Act
      const result = validator.safeValidate(requestWithExtraHeaders);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.header).not.toHaveProperty("Extra-Header");
      expect(result.data.header).not.toHaveProperty("Another-Extra");
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

    test("should strip additional fields from path parameters", () => {
      // Arrange
      const validator = new GetTodoRequestValidator();
      const requestWithExtraParams = createGetTodoRequest({
        param: {
          todoId: "01K0W0Y49HZVW1QTN6RZJJY203",
          extraPathParam: "should be stripped",
          anotherPathParam: 789,
        } as any,
      });

      // Act
      const result = validator.safeValidate(requestWithExtraParams);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.param).not.toHaveProperty("extraPathParam");
      expect(result.data.param).not.toHaveProperty("anotherPathParam");
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

    test("should strip additional fields from query parameters", () => {
      // Arrange
      const validator = new ListTodosRequestValidator();
      const requestWithExtraQuery = createListTodosRequest({
        query: {
          status: "TODO",
          extraParam: "should be stripped",
          anotherParam: 456,
        } as any,
      });

      // Act
      const result = validator.safeValidate(requestWithExtraQuery);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.query).not.toHaveProperty("extraParam");
      expect(result.data.query).not.toHaveProperty("anotherParam");
    });
  });

  describe("Cross-Component Validation", () => {
    test("should accumulate multiple validation errors", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const invalidRequest = createCreateTodoRequest({
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

    test("should strip additional fields from all request components", () => {
      // Arrange
      const validator = new QuerySubTodoRequestValidator();
      const requestWithExtraFieldsEverywhere = createQuerySubTodoRequest({
        header: {
          Accept: "application/json",
          "Extra-Header": "stripped",
        } as any,
        param: {
          todoId: "01K0W0ZJA0DQE5D3CB5MP2FGKT",
          extraParam: "stripped",
        } as any,
        query: {
          sortBy: "createdAt",
          extraQuery: "stripped",
        } as any,
        body: {
          status: "TODO",
          extraBody: "stripped",
        } as any,
      });

      // Act
      const result = validator.safeValidate(requestWithExtraFieldsEverywhere);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.header).not.toHaveProperty("Extra-Header");
      expect(result.data.param).not.toHaveProperty("extraParam");
      expect(result.data.query).not.toHaveProperty("extraQuery");
      expect(result.data.body).not.toHaveProperty("extraBody");
    });
  });

  describe("Method Variants", () => {
    test("both methods should return consistent results on success", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const validRequest = createCreateTodoRequest();

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
      const invalidRequest = createCreateTodoRequest({
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
