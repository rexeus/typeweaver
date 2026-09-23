import { badRequestDefaultError } from "@rexeus/typeweaver-core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { expectRequest, invokeNodeAdapter } from "./fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Node absolute-form URL validation", () => {
  test("returns bad request for absolute-form request URLs without a host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test:8080/items?filter=active",
      headers: { host: undefined },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("accepts absolute-form request URLs when the host header matches", async () => {
    const { request, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test:8080/items?filter=active",
      headers: { host: "api.example.test:8080" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(200);
    expect(expectRequest(request).url).toBe(
      "http://api.example.test:8080/items?filter=active"
    );
  });

  test("accepts HTTPS absolute-form request URLs with a default-port host header", async () => {
    const { request, res } = await invokeNodeAdapter({
      method: "GET",
      url: "https://api.example.test/items",
      headers: { host: "api.example.test" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(200);
    expect(expectRequest(request).url).toBe("https://api.example.test/items");
  });

  test("accepts HTTPS absolute-form request URLs when the host header matches a non-default port", async () => {
    const { request, res } = await invokeNodeAdapter({
      method: "GET",
      url: "https://api.example.test:8443/items",
      headers: { host: "api.example.test:8443" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(200);
    expect(expectRequest(request).url).toBe(
      "https://api.example.test:8443/items"
    );
  });
});

describe("Node absolute-form authority matching", () => {
  test("accepts absolute-form request URLs when the host header matches case-insensitively", async () => {
    const { request, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test:8080/items",
      headers: { host: "API.EXAMPLE.TEST:8080" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(200);
    expect(expectRequest(request).url).toBe(
      "http://api.example.test:8080/items"
    );
  });

  test("returns bad request for absolute-form request URLs when the host header mismatches", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test:8080/items?filter=active",
      headers: { host: "other.example.test:8080" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("returns bad request for HTTPS absolute-form request URLs when the host header uses the wrong effective port", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "https://api.example.test/items",
      headers: { host: "api.example.test:80" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("returns bad request for absolute-form request URLs with a malformed host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://api.example.test/items",
      headers: { host: "bad host" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("forwards custom methods without normalizing case", async () => {
    const { request } = await invokeNodeAdapter({
      method: "custom",
      url: "/items/1",
      response: new Response(""),
    });

    expect(expectRequest(request).method).toBe("custom");
  });
});

describe("Node raw Host validation and request targets", () => {
  test("accepts origin-form URLs when headersDistinct has no host value and rawHeaders contains one host line", async () => {
    const { request, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
      headers: { host: "localhost:3000" },
      wireMetadata: {
        rawHeaders: ["Host", "localhost:3000"],
        headersDistinct: {},
      },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(200);
    expect(expectRequest(request).url).toBe(
      "http://localhost:3000/items?filter=active"
    );
  });

  test.each([
    { scenario: "double slashes", url: "//attacker.example/path" },
    { scenario: "slash then backslash", url: "/\\attacker.example/path" },
    { scenario: "double backslashes", url: "\\\\attacker.example/path" },
    { scenario: "backslash then slash", url: "\\/attacker.example/path" },
  ])(
    "returns bad request for authority-like request targets with $scenario",
    async ({ url }) => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "GET",
        url,
        headers: { host: "victim.example" },
        response: new Response(""),
      });

      expect(res.writtenStatus).toBe(400);
      expect(JSON.parse(res.writtenBody)).toEqual({
        code: badRequestDefaultError.code,
        message: badRequestDefaultError.message,
      });
      expect(receivedRequests).toHaveLength(0);
    }
  );

  test("dispatches OPTIONS asterisk-form request targets as an app-visible wildcard URL", async () => {
    const { request, receivedRequests, res } = await invokeNodeAdapter({
      method: "OPTIONS",
      url: "*",
      headers: { host: "localhost:3000" },
      response: new Response(null, { status: 204 }),
    });

    expect(res.writtenStatus).toBe(204);
    expect(expectRequest(request).url).toBe("http://localhost:3000/*");
    expect(expectRequest(request).method).toBe("OPTIONS");
    expect(receivedRequests).toHaveLength(1);
  });

  test("returns bad request for OPTIONS asterisk-form request targets when rawHeaders contains duplicate host lines", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "OPTIONS",
      url: "*",
      headers: { host: "localhost:3000" },
      wireMetadata: {
        rawHeaders: ["Host", "localhost:3000", "hOSt", "localhost:3001"],
      },
      response: new Response(null, { status: 204 }),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("returns bad request for non-OPTIONS asterisk-form request targets", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "*",
      headers: { host: "localhost:3000" },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });
});
