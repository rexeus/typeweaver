import { TestAssertionError, TestIoError, TestSetupError } from "test-utils";
import { describe, expect, test } from "vitest";
import { FetchApiAdapter } from "../../../src/lib/FetchApiAdapter.js";
import { BASE_URL } from "../../helpers.js";
import {
  createAdapterRequest,
  createPrevalidatedRequest,
  expectBodyParseError,
  requireUnknownRecord,
} from "./fixtures.js";

function createPrevalidatedRequestWithUnreadableText(
  contentType: string | undefined,
  error: Error
): Request {
  const request = createPrevalidatedRequest(
    "/todos",
    {
      method: "POST",
      ...(contentType === undefined
        ? {}
        : { headers: { "Content-Type": contentType } }),
      body: new TextEncoder().encode("unreadable"),
    },
    64
  );
  Object.defineProperty(request, "text", {
    value: () => Promise.reject(error),
  });
  return request;
}

function createRequiredTestFile(): File {
  if (typeof File === "undefined") {
    throw new TestSetupError("The Node 22+ test runtime must provide File.");
  }

  return new File(["file contents"], "todo.txt", { type: "text/plain" });
}

describe("Fetch Content-Type matching", () => {
  test("parses JSON media types with surrounding whitespace and parameters", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": " application/json ; charset=utf-8 ",
      },
      body: JSON.stringify({ title: "Whitespace Test" }),
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toEqual({ title: "Whitespace Test" });
  });

  test("treats text/html+json-not-really as raw text", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "text/html+json-not-really" },
      body: "not json",
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe("not json");
  });

  test("parses text/html as text when the body looks like JSON", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "text/html" },
      body: '{"title": "test"}',
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe('{"title": "test"}');
  });

  test("strips charset parameters before matching content type", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ title: "Charset Test" }),
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toEqual({ title: "Charset Test" });
  });

  test("matches content type case-insensitively", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "Application/JSON" },
      body: JSON.stringify({ title: "Case Test" }),
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toEqual({ title: "Case Test" });
  });

  test("parses form-urlencoded bodies with charset parameters", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body: "title=Test",
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toEqual({ title: "Test" });
  });
});

describe("Fetch multipart request bodies", () => {
  test("parses multipart form fields", async () => {
    const adapter = new FetchApiAdapter();
    const formData = new FormData();
    formData.append("title", "Test Todo");
    formData.append("tags", "tag1");
    formData.append("tags", "tag2");

    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      body: formData,
    });

    const result = await adapter.toRequest(request);
    const body = requireUnknownRecord(result.body);

    expect(body["title"]).toBe("Test Todo");
    expect(body["tags"]).toEqual(["tag1", "tag2"]);
  });

  test("preserves multipart File values", async () => {
    const adapter = new FetchApiAdapter();
    const formData = new FormData();
    const file = createRequiredTestFile();
    formData.append("attachment", file);

    const request = createAdapterRequest("/todos", {
      method: "POST",
      body: formData,
    });

    const result = await adapter.toRequest(request);
    const body = requireUnknownRecord(result.body);
    const { attachment } = body;

    expect(attachment).toBeInstanceOf(File);
    if (!(attachment instanceof File)) {
      throw new TestAssertionError("Expected a File attachment");
    }
    expect(attachment.name).toBe("todo.txt");
    expect(attachment.type).toBe("text/plain");
    await expect(attachment.text()).resolves.toBe("file contents");
  });

  test("throws BodyParseError for malformed multipart form bodies", async () => {
    const request = createAdapterRequest("/todos", {
      method: "POST",
      headers: { "Content-Type": "multipart/form-data; boundary=invalid" },
      body: "this is not valid multipart data",
    });

    await expectBodyParseError(request, "multipart/form-data");
  });
});

describe("Fetch raw request bodies and read failures", () => {
  test("falls back to raw text for unknown content types", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: "raw binary-ish data",
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe("raw binary-ish data");
  });

  test("omits raw body when an unknown content type has empty body text", async () => {
    const adapter = new FetchApiAdapter();
    const request = new Request(`${BASE_URL}/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: "",
    });

    const result = await adapter.toRequest(request);

    expect(result.body).toBeUndefined();
  });

  test("throws BodyParseError when text body reads fail", async () => {
    const request = createPrevalidatedRequestWithUnreadableText(
      "text/plain",
      new TestIoError("read failed")
    );

    await expectBodyParseError(request, "Failed to read text request body");
  });

  test("throws BodyParseError when form-urlencoded body reads fail", async () => {
    const request = createPrevalidatedRequestWithUnreadableText(
      "application/x-www-form-urlencoded",
      new TestIoError("read failed")
    );

    await expectBodyParseError(
      request,
      "Failed to read form-urlencoded request body"
    );
  });

  test("throws BodyParseError when raw body reads fail", async () => {
    const request = createPrevalidatedRequestWithUnreadableText(
      undefined,
      new TestIoError("read failed")
    );

    await expectBodyParseError(request, "Failed to read request body");
  });
});
