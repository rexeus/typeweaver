import { TestIoError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import {
  createNodeBodyLimitPolicy,
  markRequestBodyPrevalidated,
} from "../../../src/lib/BodyLimitPolicy.js";
import { FetchApiAdapter } from "../../../src/lib/FetchApiAdapter.js";
import {
  createAdapterRequestWithStream,
  createBodyStream,
  createPrevalidatedRequest,
  createSixByteStream,
  expectPayloadTooLargeError,
} from "./fixtures.js";

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

describe("Fetch streaming body cancellation", () => {
  test("rejects stream chunks one byte over the body limit and cancels the stream", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = createBodyStream(["he", "ll", "o"], cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "text/plain" },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize: 4 });

    await expectPayloadTooLargeError(adapter.toRequest(request), 5, 4);

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  test("does not cancel streams that finish within the body limit", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = createBodyStream(["safe"], cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "text/plain" },
      body
    );
    const adapter = new FetchApiAdapter({ maxBodySize: 4 });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe("safe");
    expect(cancel).not.toHaveBeenCalled();
  });

  test("trusts satisfied prevalidated request bodies without duplicate streaming rejection", async () => {
    const bodyThatWouldFailIfReread = "hello";
    const fetchMaxBodySize = 4;
    const request = createPrevalidatedRequest(
      "/todos",
      {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: bodyThatWouldFailIfReread,
      },
      fetchMaxBodySize
    );
    const adapter = new FetchApiAdapter({ maxBodySize: fetchMaxBodySize });

    const result = await adapter.toRequest(request);

    expect(result.body).toBe(bodyThatWouldFailIfReread);
  });

  test("revalidates looser prevalidated request bodies through the stream", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const body = createBodyStream(["hello"], cancel);
    const request = createAdapterRequestWithStream(
      "/todos",
      { "Content-Type": "text/plain" },
      body
    );
    markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(8));
    const adapter = new FetchApiAdapter({ maxBodySize: 4 });

    await expectPayloadTooLargeError(adapter.toRequest(request), 5, 4);

    expect(cancel).toHaveBeenCalledTimes(1);
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
