import assert from "node:assert";
import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  CreateTodoRequestValidator,
  QuerySubTodoRequestValidator,
  UploadFileRequestValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  AUTHORIZATION,
  issuePaths,
  requestWithRuntimePart,
  validCreateTodoRequest,
  validQuerySubTodoRequest,
} from "./fixtures.js";
import type { IUploadFileRequest } from "test-utils";

const validUploadFileRequest = (): IUploadFileRequest => ({
  method: HttpMethod.POST,
  path: "/files",
  header: {
    "Content-Type": "application/octet-stream",
    Authorization: AUTHORIZATION,
    "X-File-Name": "reference.txt",
  },
  body: new Uint8Array([1, 2, 3]),
});

describe("Generated RequestValidator body object contracts", () => {
  test("strips unknown top-level body fields from a valid body", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      title: "Only known body fields remain",
      description: "Unknown fields are not part of the contract.",
      extraBodyField: "strip me",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.body).toEqual({
      title: "Only known body fields remain",
      description: "Unknown fields are not part of the contract.",
    });
  });

  test("reports bodyIssues when a required body field is missing", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      description: "The required title is missing.",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.bodyIssues)).toContainEqual(["title"]);
    expect(result.error.headerIssues).toHaveLength(0);
  });

  test("accepts a body with optional fields omitted", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      title: "Minimal todo",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.body).toEqual({ title: "Minimal todo" });
  });

  test("reports bodyIssues when an optional enum has an invalid value", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      title: "Invalid priority",
      priority: "URGENT",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.bodyIssues)).toContainEqual(["priority"]);
    expect(result.error.headerIssues).toHaveLength(0);
  });

  test("accepts an empty object for an all-optional body schema", () => {
    const validator = new QuerySubTodoRequestValidator();
    const request = requestWithRuntimePart(
      validQuerySubTodoRequest(),
      "body",
      {}
    );

    const result = validator.safeValidate(request);
    expect(result.isValid).toBe(true);
    assert(result.isValid);

    expect(result.data.body).toEqual({});
  });
});

describe("Generated RequestValidator body shape contracts", () => {
  test.each([
    { scenario: "null", body: null },
    { scenario: "primitive string", body: "not an object" },
    { scenario: "primitive number", body: 42 },
    { scenario: "array", body: ["not", "a", "body"] },
  ])("reports bodyIssues for a malformed $scenario body", ({ body }) => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(
      validCreateTodoRequest(),
      "body",
      body
    );

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(result.error.bodyIssues.length).toBeGreaterThan(0);
    expect(result.error.headerIssues).toHaveLength(0);
  });

  test("reports bodyIssues without coercion when a body array field receives a singleton", () => {
    const validator = new CreateTodoRequestValidator();
    const request = requestWithRuntimePart(validCreateTodoRequest(), "body", {
      title: "Do not coerce body arrays",
      tags: "testing",
    });

    const result = validator.safeValidate(request);

    expect(result.isValid).toBe(false);
    assert(!result.isValid);
    expect(issuePaths(result.error.bodyIssues)).toContainEqual(["tags"]);
    expect(result.error.headerIssues).toHaveLength(0);
  });

  test.each([
    { scenario: "Uint8Array", body: new Uint8Array([1, 2, 3]) },
    { scenario: "string", body: "raw file contents" },
  ])(
    "accepts a non-object $scenario body for a z.any upload payload",
    ({ body }) => {
      const validator = new UploadFileRequestValidator();
      const request = requestWithRuntimePart(
        validUploadFileRequest(),
        "body",
        body
      );

      const result = validator.safeValidate(request);
      expect(result.isValid).toBe(true);
      assert(result.isValid);

      expect(result.data.body).toEqual(body);
    }
  );
});
