import { badRequestDefaultError } from "@rexeus/typeweaver-core";
import { afterEach, describe, expect, test, vi } from "vitest";
import { invokeNodeAdapter } from "./fixtures.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Node origin-form Host validation", () => {
  test("returns bad request for origin-form URLs without a host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
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

  test("returns bad request for origin-form URLs with a malformed host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
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

  test("returns bad request for origin-form URLs with an empty host header", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
      headers: { host: "" },
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

describe("Node origin-form authority validation", () => {
  test.each([
    { headers: { host: undefined }, scenario: "a missing host header" },
    { headers: { host: "bad host" }, scenario: "a malformed host header" },
  ])(
    "returns bad request without a body for HEAD requests with $scenario",
    async ({ headers }) => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "HEAD",
        url: "/items?filter=active",
        headers,
        response: new Response(""),
      });

      expect(res.writtenStatus).toBe(400);
      expect(res.writtenBodyBuffer).toEqual(Buffer.alloc(0));
      expect(receivedRequests).toHaveLength(0);
    }
  );

  test.each([
    { host: " localhost:3000", scenario: "leading whitespace" },
    { host: "localhost:3000 ", scenario: "trailing whitespace" },
  ])(
    "returns bad request for origin-form URLs when the host has $scenario",
    async ({ host }) => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "GET",
        url: "/items?filter=active",
        headers: { host },
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

  test.each([
    { host: "localhost:3000/path", scenario: "a path" },
    { host: "localhost:3000?x=1", scenario: "a query string" },
    { host: "user@localhost:3000", scenario: "userinfo" },
    { host: "localhost:3000#hash", scenario: "a fragment" },
  ])(
    "returns bad request for origin-form URLs when the host contains $scenario",
    async ({ host }) => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "GET",
        url: "/items?filter=active",
        headers: { host },
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
});

describe("Node duplicate Host validation", () => {
  test("returns bad request for origin-form URLs with duplicate host headers", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
      headers: { host: ["localhost:3000", "localhost:3001"] },
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

describe("Node Host provenance validation", () => {
  test.each([
    { scenario: "origin-form URLs", url: "/items?filter=active" },
    {
      scenario: "absolute-form URLs",
      url: "http://localhost:3000/items?filter=active",
    },
  ])(
    "returns bad request for $scenario when rawHeaders contains duplicate host lines",
    async ({ url }) => {
      const { receivedRequests, res } = await invokeNodeAdapter({
        method: "GET",
        url,
        headers: { host: "localhost:3000" },
        wireMetadata: {
          rawHeaders: ["Host", "localhost:3000", "hOSt", "localhost:3001"],
        },
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

  test("returns bad request for origin-form URLs when headersDistinct contains duplicate host values", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "/items?filter=active",
      headers: { host: "localhost:3000" },
      wireMetadata: {
        rawHeaders: ["Host", "localhost:3000"],
        headersDistinct: { host: ["localhost:3000", "localhost:3001"] },
      },
      response: new Response(""),
    });

    expect(res.writtenStatus).toBe(400);
    expect(JSON.parse(res.writtenBody)).toEqual({
      code: badRequestDefaultError.code,
      message: badRequestDefaultError.message,
    });
    expect(receivedRequests).toHaveLength(0);
  });

  test("returns bad request for absolute-form URLs when headersDistinct contains duplicate host values", async () => {
    const { receivedRequests, res } = await invokeNodeAdapter({
      method: "GET",
      url: "http://localhost:3000/items?filter=active",
      headers: { host: "localhost:3000" },
      wireMetadata: {
        rawHeaders: ["Host", "localhost:3000"],
        headersDistinct: { host: ["localhost:3000", "localhost:3001"] },
      },
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
