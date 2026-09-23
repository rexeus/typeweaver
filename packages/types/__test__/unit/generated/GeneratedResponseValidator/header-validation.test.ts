import assert from "node:assert";
import {
  CreateTodoResponseValidator,
  OptionsTodoResponseValidator,
} from "test-utils";
import { describe, expect, test } from "vitest";
import {
  expectNoPartialData,
  issuePaths,
  responseIssueFor,
  responseWithRuntimePart,
  safeValidateRaw,
  validCreateTodoHeader,
  validCreateTodoResponse,
  validOptionsTodoHeader,
  validOptionsTodoResponse,
  withoutRuntimePart,
} from "./fixtures.js";

describe("Generated ResponseValidator header casing", () => {
  test("returns schema-cased parsed headers for a valid response", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        "content-type": "application/json",
        "x-single-value": "request-1",
        "x-multi-value": ["alpha", "0"],
      }
    );

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header).toEqual(validCreateTodoHeader());
  });

  test("strips unknown response header keys", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "X-Trace-Id": "trace-1",
      }
    );

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header).toEqual(validCreateTodoHeader());
    expect(result.data.header).not.toHaveProperty("X-Trace-Id");
  });

  test("normalizes case-insensitive header keys to schema casing", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        "CONTENT-TYPE": "application/json",
        "x-single-value": "request-1",
        "x-multi-value": ["alpha", "0"],
      }
    );

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header).toEqual(validCreateTodoHeader());
    expect(result.data.header).not.toHaveProperty("CONTENT-TYPE");
    expect(result.data.header).not.toHaveProperty("x-single-value");
    expect(result.data.header).not.toHaveProperty("x-multi-value");
  });
});

describe("Generated ResponseValidator header cardinality", () => {
  test("merges duplicate casing collisions for array header schemas", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "x-multi-value": ["beta", "1"],
      }
    );

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header["X-Multi-Value"]).toEqual([
      "alpha",
      "0",
      "beta",
      "1",
    ]);
    expect(result.data.header).not.toHaveProperty("x-multi-value");
  });

  test("wraps a single header value when the schema expects an array", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "X-Multi-Value": "solo",
      }
    );

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header["X-Multi-Value"]).toEqual(["solo"]);
  });

  test("unwraps a single-element header array when the schema expects a scalar", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "X-Single-Value": ["solo"],
      }
    );

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("CreateTodoSuccess");
    assert(result.data.type === "CreateTodoSuccess");
    expect(result.data.header["X-Single-Value"]).toBe("solo");
  });
});

describe("Generated ResponseValidator header string normalization", () => {
  test("rejects a multi-element header array when the schema expects a scalar", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "X-Single-Value": ["one", "two"],
      }
    );

    const result = safeValidateRaw(validator, response);

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(
      issuePaths(result.error.getResponseHeaderIssues("CreateTodoSuccess"))
    ).toEqual(["X-Single-Value"]);
  });

  test("splits comma-separated strings only for array header schema fields", () => {
    const validator = new OptionsTodoResponseValidator();
    const response = responseWithRuntimePart(
      validOptionsTodoResponse(),
      "header",
      {
        ...validOptionsTodoHeader(),
        Allow: " GET, ,0, OPTIONS, ",
      }
    );

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("OptionsTodoSuccess");
    assert(result.data.type === "OptionsTodoSuccess");
    expect(result.data.header.Allow).toEqual(["GET", "0", "OPTIONS"]);
  });

  test("does not split comma-separated strings for scalar header schema fields", () => {
    const validator = new OptionsTodoResponseValidator();
    const response = responseWithRuntimePart(
      validOptionsTodoResponse(),
      "header",
      {
        ...validOptionsTodoHeader(),
        "Access-Control-Allow-Origin":
          "https://one.example, https://two.example",
      }
    );

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("OptionsTodoSuccess");
    assert(result.data.type === "OptionsTodoSuccess");
    expect(result.data.header["Access-Control-Allow-Origin"]).toBe(
      "https://one.example, https://two.example"
    );
  });
});

describe("Generated ResponseValidator malformed and duplicate headers", () => {
  test("does not re-split header values that are already arrays", () => {
    const validator = new OptionsTodoResponseValidator();
    const response = responseWithRuntimePart(
      validOptionsTodoResponse(),
      "header",
      {
        ...validOptionsTodoHeader(),
        Allow: ["GET,POST", "OPTIONS"],
      }
    );

    const result = safeValidateRaw(validator, response);

    expect(result.isValid).toBe(true);
    assert(result.isValid);
    expect(result.data.type).toBe("OptionsTodoSuccess");
    assert(result.data.type === "OptionsTodoSuccess");
    expect(result.data.header.Allow).toEqual(["GET,POST", "OPTIONS"]);
  });

  test.each([
    { scenario: "null header", header: null },
    { scenario: "primitive header", header: "not an object" },
    { scenario: "array header", header: [validCreateTodoHeader()] },
  ])(
    "rejects a malformed required header shape for $scenario",
    ({ header }) => {
      const validator = new CreateTodoResponseValidator();
      const response = responseWithRuntimePart(
        validCreateTodoResponse(),
        "header",
        header
      );

      const result = safeValidateRaw(validator, response);

      expectNoPartialData(result);
      assert(!result.isValid);
      expect(
        responseIssueFor(result.error, "CreateTodoSuccess").headerIssues.length
      ).toBeGreaterThan(0);
    }
  );

  test("reports a missing required header part without a status-code issue", () => {
    const validator = new CreateTodoResponseValidator();
    const response = withoutRuntimePart(validCreateTodoResponse(), "header");

    const result = safeValidateRaw(validator, response);

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(result.error.hasStatusCodeIssues()).toBe(false);
    expect(
      responseIssueFor(result.error, "CreateTodoSuccess").headerIssues.length
    ).toBeGreaterThan(0);
    expect(
      responseIssueFor(result.error, "CreateTodoSuccess").bodyIssues
    ).toHaveLength(0);
  });

  test("rejects duplicate casing collisions for singleton header schemas", () => {
    const validator = new CreateTodoResponseValidator();
    const response = responseWithRuntimePart(
      validCreateTodoResponse(),
      "header",
      {
        ...validCreateTodoHeader(),
        "content-type": "application/json",
      }
    );

    const result = safeValidateRaw(validator, response);

    expectNoPartialData(result);
    assert(!result.isValid);
    expect(
      issuePaths(result.error.getResponseHeaderIssues("CreateTodoSuccess"))
    ).toEqual(["Content-Type"]);
  });
});
