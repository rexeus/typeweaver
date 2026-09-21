import { TestAssertionError, TestIoError, TestSetupError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  createNodeBodyLimitPolicy,
  markRequestBodyPrevalidated,
} from "../../src/lib/BodyLimitPolicy.js";
import { BodyParseError, PayloadTooLargeError } from "../../src/lib/Errors.js";
import { FetchApiAdapter } from "../../src/lib/FetchApiAdapter.js";
import { BASE_URL } from "../helpers.js";

function createAdapterRequest(path: string, init?: RequestInit): Request {
  return new Request(`${BASE_URL}${path}`, init);
}

function createAdapterRequestWithStream(
  path: string,
  headers: Record<string, string>,
  body: ReadableStream<Uint8Array>
): Request {
  const request = createAdapterRequest(path, { method: "POST", headers });
  Object.defineProperty(request, "body", { value: body });
  return request;
}

function parseRequest(request: Request, url?: URL) {
  return new FetchApiAdapter().toRequest(request, url);
}

function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireUnknownRecord(value: unknown): Record<string, unknown> {
  if (!isUnknownRecord(value)) {
    throw new TestAssertionError("Expected an object body");
  }
  return value;
}

function createByteStream(
  chunks: readonly Uint8Array[],
  cancel: () => Promise<void>
): ReadableStream<Uint8Array> {
  const queuedChunks = [...chunks];

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = queuedChunks.shift();
      if (chunk) {
        controller.enqueue(chunk);
        return;
      }
      controller.close();
    },
    cancel,
  });
}

function createSixByteStream(
  cancel: () => Promise<void>
): ReadableStream<Uint8Array> {
  return createByteStream(
    [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])],
    cancel
  );
}

function createFailingBodyReadStream(
  readFailure: Error,
  cancel: () => Promise<void>
): ReadableStream<Uint8Array> {
  let hasEnqueuedFailure = false;
  const failingChunk = Object.defineProperty({}, "byteLength", {
    get() {
      throw readFailure;
    },
  }) as Uint8Array;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (hasEnqueuedFailure) {
        return;
      }

      hasEnqueuedFailure = true;
      controller.enqueue(failingChunk);
    },
    cancel,
  });
}

async function expectBodyParseError(
  request: Request,
  expectedMessage: string
): Promise<void> {
  await expect(parseRequest(request)).rejects.toSatisfy(
    (error: BodyParseError) => {
      expect(error).toBeInstanceOf(BodyParseError);
      expect(error.message).toContain(expectedMessage);
      expect(error.cause).toBeDefined();
      return true;
    }
  );
}

async function expectPayloadTooLargeError(
  promise: Promise<unknown>,
  expectedContentLength: number,
  expectedMaxBodySize: number
): Promise<void> {
  await expect(promise).rejects.toSatisfy((error: PayloadTooLargeError) => {
    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect(error.contentLength).toBe(expectedContentLength);
    expect(error.maxBodySize).toBe(expectedMaxBodySize);
    expect(error.message).toContain(`${expectedContentLength} bytes`);
    expect(error.message).toContain(`${expectedMaxBodySize} bytes`);
    return true;
  });
}

function createPrevalidatedRequest(
  path: string,
  init: RequestInit,
  maxBodySize = 1_048_576
): Request {
  const request = createAdapterRequest(path, init);
  markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(maxBodySize));
  return request;
}

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

describe("Fetch request stream cancellation", () => {
  test("cancels oversized request streams without masking the original error", async () => {
    const cancel = vi.fn().mockRejectedValue(new TestIoError("cancel failed"));
    const actualBodySize = 6;
    const maxBodySize = 4;
    const body = createSixByteStream(cancel);
    const request = createAdapterRequestWithStream(
      "/upload",
      { "Content-Type": "application/octet-stream" },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize });

    await expectPayloadTooLargeError(
      adapter.toRequest(request),
      actualBodySize,
      maxBodySize
    );

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("cancels oversized multipart request streams without masking the size-limit error", async () => {
    const cancel = vi.fn().mockRejectedValue(new TestIoError("cancel failed"));
    const actualBodySize = 6;
    const maxBodySize = 4;
    const body = createSixByteStream(cancel);
    const request = createAdapterRequestWithStream(
      "/upload",
      { "Content-Type": "multipart/form-data; boundary=typeweaver-test" },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize });

    await expectPayloadTooLargeError(
      adapter.toRequest(request),
      actualBodySize,
      maxBodySize
    );

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("cancels multipart request streams after body read failures without masking the original error", async () => {
    const readFailure = new TestIoError("read failed");
    const cancel = vi.fn().mockRejectedValue(new TestIoError("cancel failed"));
    const body = createFailingBodyReadStream(readFailure, cancel);
    const request = createAdapterRequestWithStream(
      "/upload",
      { "Content-Type": "multipart/form-data; boundary=typeweaver-test" },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize: 64 });

    await expect(adapter.toRequest(request)).rejects.toBe(readFailure);

    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
