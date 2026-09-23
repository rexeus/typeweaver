import { HttpMethod } from "@rexeus/typeweaver-core";
import { NamedTestError, TestAssertionError } from "test-utils";
import { describe, expect, test, vi } from "vitest";
import { NetworkError } from "../../../src/lib/NetworkError.js";
import {
  createClient,
  getFetchCall,
  resolvedFetch,
  sendRaw,
  TestRequestCommand,
} from "./fixtures.js";
import type { NetworkErrorCode } from "../../../src/lib/NetworkError.js";

function rejectedFetch(error: unknown) {
  return vi.fn<typeof globalThis.fetch>().mockRejectedValue(error);
}

describe("ApiClient network errors and timeout signals", () => {
  test.each([
    { code: "ECONNREFUSED", message: "Connection refused" },
    { code: "ECONNRESET", message: "Connection reset by peer" },
    { code: "ENOTFOUND", message: "DNS lookup failed" },
    { code: "ETIMEDOUT", message: "Connection timed out" },
  ] satisfies ReadonlyArray<{
    readonly code: NetworkErrorCode;
    readonly message: string;
  }>)(
    "maps Node-like $code fetch failures to NetworkError",
    async ({ code, message }) => {
      const cause = Object.assign(new TypeError("fetch failed"), {
        cause: { code },
      });
      const client = createClient(rejectedFetch(cause));

      await expect(
        client.send(
          new TestRequestCommand({
            path: "/todos/:todoId",
            param: { todoId: "abc" },
          })
        )
      ).rejects.toSatisfy((error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === code &&
          error.method === "GET" &&
          error.url === "http://localhost:3000/todos/abc" &&
          error.cause === cause &&
          error.message ===
            `Network error: ${message} (GET http://localhost:3000/todos/abc)`
        );
      });
    }
  );

  test("maps unknown TypeError fetch failures to UNKNOWN NetworkError", async () => {
    const cause = new TypeError("fetch failed");
    const client = createClient(rejectedFetch(cause));

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "UNKNOWN" &&
          error.cause === cause &&
          error.message ===
            "Network error: fetch failed (GET http://localhost:3000/todos)"
        );
      }
    );
  });
});

describe("ApiClient unknown network errors", () => {
  test("maps non-Error fetch rejections to UNKNOWN NetworkError", async () => {
    const client = createClient(rejectedFetch("something broke"));

    await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "UNKNOWN" &&
          error.cause === "something broke" &&
          error.message ===
            "Network error: something broke (GET http://localhost:3000/todos)"
        );
      }
    );
  });

  test.each([
    { case: "AbortError", name: "AbortError", code: "ABORT" },
    { case: "TimeoutError", name: "TimeoutError", code: "TIMEOUT" },
  ] as const)(
    "maps $case fetch failures to $code NetworkError",
    async ({ name, code }) => {
      const cause = new DOMException("request failed", name);
      const client = createClient(rejectedFetch(cause));

      await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
        (error: unknown) => {
          return (
            error instanceof NetworkError &&
            error.code === code &&
            error.cause === cause &&
            error.method === "GET" &&
            error.url === "http://localhost:3000/todos"
          );
        }
      );
    }
  );

  test.each([
    { case: "AbortError", name: "AbortError", code: "ABORT" },
    { case: "TimeoutError", name: "TimeoutError", code: "TIMEOUT" },
  ] as const)(
    "maps non-DOM $case fetch failures to $code NetworkError",
    async ({ name, code }) => {
      const cause = new NamedTestError(name, "request failed");
      const client = createClient(rejectedFetch(cause));

      await expect(client.send(new TestRequestCommand())).rejects.toSatisfy(
        (error: unknown) => {
          return (
            error instanceof NetworkError &&
            error.code === code &&
            error.cause === cause &&
            error.method === "GET" &&
            error.url === "http://localhost:3000/todos"
          );
        }
      );
    }
  );
});

describe("ApiClient timeout signals", () => {
  test("omits the abort signal when timeoutMs is not configured", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);

    await client.send(new TestRequestCommand());

    expect(getFetchCall(mockFetch).init.signal).toBeUndefined();
  });

  test("passes an abort signal when timeoutMs is configured", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch, { timeoutMs: 1000 });

    await client.send(new TestRequestCommand());

    expect(getFetchCall(mockFetch).init.signal).toBeInstanceOf(AbortSignal);
  });

  test("aborts an in-flight request when timeoutMs elapses", async () => {
    const cause = new DOMException("timed out", "TimeoutError");
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutController.signal);
    const mockFetch = vi.fn<typeof globalThis.fetch>((_input, init) => {
      const signal = init?.signal;
      if (signal == null) {
        return Promise.reject(
          new TestAssertionError("Expected fetch to receive a signal")
        );
      }

      return new Promise<Response>((_resolve, reject) => {
        if (signal.aborted) {
          reject(cause);
          return;
        }

        signal.addEventListener("abort", () => reject(cause), { once: true });
      });
    });
    const client = createClient(mockFetch, { timeoutMs: 50 });

    try {
      const request = client.send(
        new TestRequestCommand({
          path: "/todos/:todoId",
          param: { todoId: "abc" },
        })
      );
      timeoutController.abort(cause);

      await expect(request).rejects.toSatisfy((error: unknown) => {
        return (
          error instanceof NetworkError &&
          error.code === "TIMEOUT" &&
          error.method === "GET" &&
          error.url === "http://localhost:3000/todos/abc" &&
          error.cause === cause
        );
      });
      expect(timeoutSpy).toHaveBeenCalledWith(50);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      timeoutSpy.mockRestore();
    }
  });
});

describe("ApiClient cancellation", () => {
  test("forwards an external AbortSignal to fetch", async () => {
    const abortController = new AbortController();
    const { mockFetch } = await sendRaw(
      { method: HttpMethod.GET },
      { signal: abortController.signal }
    );

    expect(getFetchCall(mockFetch).init.signal).toBe(abortController.signal);
  });
});
