import assert from "assert";
import { RequestValidationError } from "@rexeus/typeweaver-core";
import {
  captureError,
  createCreateTodoRequest,
  createGetTodoRequest,
  createListTodosRequest,
  createQuerySubTodoRequest,
  CreateTodoRequestValidator,
  GetTodoRequestValidator,
  ListTodosRequestValidator,
  QuerySubTodoRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";

describe("Generated RequestValidator", () => {
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

    test("should coerce header keys to match schema case-insensitively", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const requestWithMixedCaseHeaders = createCreateTodoRequest({
        header: {
          // @ts-expect-error Wrong case for testing
          accept: "application/json" as any, // Should match schema's "Accept"
          authorization: "Bearer token123" as any, // Should match schema's "Authorization"
          "CONTENT-TYPE": "application/json" as any, // Should match schema's "Content-Type"
        },
      });
      // Remove the headers in correct casing to test coercion
      delete (requestWithMixedCaseHeaders.header as any)["Accept"];
      delete (requestWithMixedCaseHeaders.header as any)["Authorization"];
      delete (requestWithMixedCaseHeaders.header as any)["Content-Type"];

      // Act
      const result = validator.safeValidate(requestWithMixedCaseHeaders);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.header.Accept).toBe("application/json");
      expect(result.data.header.Authorization).toBe("Bearer token123");
      expect(result.data.header["Content-Type"]).toBe("application/json");
      expect(result.data.header).not.toHaveProperty("accept");
      expect(result.data.header).not.toHaveProperty("authorization");
      expect(result.data.header).not.toHaveProperty("CONTENT-TYPE");
    });

    test("should coerce single header value to array when schema expects array", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const requestWithSingleEncoding = createCreateTodoRequest({
        header: {
          Accept: "application/json",
          "X-Multi-Value": "my-value" as any, // Schema expects array, provide single value
        },
      });

      // Act
      const result = validator.safeValidate(requestWithSingleEncoding);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.header.Accept).toBe("application/json");
      expect(result.data.header["X-Multi-Value"]).toEqual(["my-value"]);
    });

    test("should coerce array header value to single when schema expects single", () => {
      // Arrange
      const validator = new CreateTodoRequestValidator();
      const requestWithArrayHeaders = createCreateTodoRequest({
        header: {
          Accept: ["application/json"] as any, // Schema expects single string, provide array
          Authorization: ["Bearer token123"] as any, // Schema expects single string, provide array
          "Content-Type": "application/json", // This should remain single
        },
      });

      // Act
      const result = validator.safeValidate(requestWithArrayHeaders);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.header.Accept).toBe("application/json");
      expect(result.data.header.Authorization).toBe("Bearer token123");
      expect(result.data.header["Content-Type"]).toBe("application/json");
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

    test("should coerce single query value to array when schema expects array", () => {
      // Arrange
      const validator = new ListTodosRequestValidator();
      const requestWithSingleValues = createListTodosRequest({
        query: {
          limit: "10",
          tags: "personal" as any, // Schema expects array, provide single value
        },
      });

      // Act
      const result = validator.safeValidate(requestWithSingleValues);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.query?.tags).toEqual(["personal"]);
      expect(result.data.query?.limit).toBe("10");
    });

    test("should coerce array query value to single when schema expects single", () => {
      // Arrange
      const validator = new ListTodosRequestValidator();
      const requestWithArrayValues = createListTodosRequest({
        query: {
          tags: ["work", "urgent"] as any,
          limit: ["10"] as any, // Schema expects single string, provide array
        },
      });

      // Act
      const result = validator.safeValidate(requestWithArrayValues);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.query?.limit).toBe("10");
      expect(result.data.query?.tags).toEqual(["work", "urgent"]);
    });

    test("should preserve exact case for query parameter keys", () => {
      // Arrange
      const validator = new ListTodosRequestValidator();
      const requestWithMixedCase = createListTodosRequest({
        query: {
          // @ts-expect-error Wrong case for testing
          LIMIT: "20" as any, // Wrong case - should be stripped
          sortBy: "priority", // Correct case - should be preserved
        },
      });

      // Act
      const result = validator.safeValidate(requestWithMixedCase);

      // Assert
      expect(result.isValid).toBe(true);
      assert(result.isValid);
      expect(result.data.query).not.toHaveProperty("LIMIT");
      expect(result.data.query?.sortBy).toEqual("priority");
      expect(result.data.query.limit).toEqual(requestWithMixedCase.query.limit);
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
