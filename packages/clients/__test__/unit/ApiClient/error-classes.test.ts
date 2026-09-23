import { TestIoError } from "test-utils";
import { describe, expect, test } from "vitest";
import { NetworkError } from "../../../src/lib/NetworkError.js";
import { PathParameterError } from "../../../src/lib/PathParameterError.js";
import { ResponseParseError } from "../../../src/lib/ResponseParseError.js";

describe("ApiClient error classes", () => {
  test("NetworkError exposes name, message, metadata, and cause", () => {
    const cause = new TypeError("fetch failed");
    const error = new NetworkError("Connection refused", {
      cause,
      code: "ECONNREFUSED",
      method: "POST",
      url: "http://localhost:3000/api",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NetworkError");
    expect(error.message).toBe("Connection refused");
    expect(error.code).toBe("ECONNREFUSED");
    expect(error.method).toBe("POST");
    expect(error.url).toBe("http://localhost:3000/api");
    expect(error.cause).toBe(cause);
  });

  test("PathParameterError exposes name, message, metadata, and cause", () => {
    const cause = new TestIoError("underlying issue");
    const error = new PathParameterError(
      "Path parameter 'slug' is not found in path '/posts/:id'",
      "slug",
      "/posts/:id",
      { cause }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("PathParameterError");
    expect(error.message).toBe(
      "Path parameter 'slug' is not found in path '/posts/:id'"
    );
    expect(error.paramName).toBe("slug");
    expect(error.path).toBe("/posts/:id");
    expect(error.cause).toBe(cause);
  });

  test("ResponseParseError exposes name, message, metadata, and cause", () => {
    const cause = new SyntaxError("Unexpected token");
    const error = new ResponseParseError(
      "Failed to parse",
      502,
      "<html>Bad Gateway</html>",
      { cause }
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ResponseParseError");
    expect(error.message).toBe("Failed to parse");
    expect(error.statusCode).toBe(502);
    expect(error.bodyPreview).toBe("<html>Bad Gateway</html>");
    expect(error.cause).toBe(cause);
  });
});
