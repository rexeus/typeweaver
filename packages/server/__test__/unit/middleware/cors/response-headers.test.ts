import { describe, expect, test } from "vitest";
import {
  downstreamResponseWithPermissiveCorsPolicy,
  executeCors,
} from "./fixtures.js";

describe("CORS response headers", () => {
  test("sets exposed response headers", async () => {
    const response = await executeCors({
      options: { exposeHeaders: ["X-Request-Id", "X-Total-Count"] },
    });

    expect(response.header?.["access-control-expose-headers"]).toBe(
      "X-Request-Id, X-Total-Count"
    );
  });

  test("omits exposed response headers when exposeHeaders is empty", async () => {
    const response = await executeCors({
      options: { exposeHeaders: [] },
    });

    expect(response.header?.["access-control-allow-origin"]).toBe("*");
    expect(response.header?.["access-control-expose-headers"]).toBeUndefined();
  });

  test("preserves downstream status body and unrelated headers", async () => {
    const response = await executeCors({
      finalHandler: async () => ({
        statusCode: 201,
        header: { "x-custom": "value" },
        body: { created: true },
      }),
    });

    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({ created: true });
    expect(response.header?.["x-custom"]).toBe("value");
    expect(response.header?.["access-control-allow-origin"]).toBe("*");
  });

  test("merges downstream Vary values with Origin", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: { vary: "Accept-Encoding" },
      }),
    });

    expect(response.header?.["vary"]).toBe("Accept-Encoding, Origin");
  });

  test("preserves array-valued downstream Vary values when adding Origin", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: { vary: ["Accept-Encoding", "Accept-Language"] },
      }),
    });

    expect(response.header?.["vary"]).toBe(
      "Accept-Encoding, Accept-Language, Origin"
    );
  });
});

describe("CORS Vary normalization", () => {
  test("normalizes duplicate differently cased downstream Vary headers when adding Origin", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: {
          vary: "Accept-Encoding",
          Vary: "Accept-Language",
        },
      }),
    });

    expect(response.header?.["vary"]).toBe(
      "Accept-Encoding, Accept-Language, Origin"
    );
    expect(response.header?.["Vary"]).toBeUndefined();
  });

  test("does not duplicate Origin in downstream Vary values", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: { vary: "Accept-Encoding, Origin" },
      }),
    });

    expect(response.header?.["vary"]).toBe("Accept-Encoding, Origin");
  });

  test("does not duplicate differently cased Origin in downstream Vary values", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { origin: "https://app.com" },
      finalHandler: async () => ({
        statusCode: 200,
        header: { vary: "Accept-Encoding, origin" },
      }),
    });

    expect(response.header?.["vary"]).toBe("Accept-Encoding, origin");
  });

  test("lets middleware policy override conflicting downstream CORS headers", async () => {
    const response = await executeCors({
      options: { origin: "https://allowed.com", credentials: true },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          header: { "access-control-allow-credentials": "false" },
        }),
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://allowed.com"
    );
    expect(response.header?.["access-control-allow-credentials"]).toBe("true");
    expect(response.header?.["Access-Control-Allow-Origin"]).toBeUndefined();
  });
});

describe("CORS downstream policy overrides", () => {
  test("strips downstream CORS headers disabled by the middleware policy", async () => {
    const response = await executeCors({
      options: { origin: "https://allowed.com" },
      finalHandler: async () =>
        downstreamResponseWithPermissiveCorsPolicy({
          header: { "x-custom": "kept" },
        }),
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://allowed.com"
    );
    expect(response.header?.["vary"]).toBe("Origin");
    expect(response.header?.["x-custom"]).toBe("kept");
    expect(
      response.header?.["access-control-allow-credentials"]
    ).toBeUndefined();
    expect(response.header?.["access-control-expose-headers"]).toBeUndefined();
    expect(response.header?.["access-control-allow-methods"]).toBeUndefined();
    expect(response.header?.["access-control-allow-headers"]).toBeUndefined();
    expect(response.header?.["access-control-max-age"]).toBeUndefined();
  });

  test("reads the Origin request header name case-insensitively", async () => {
    const response = await executeCors({
      options: { origin: ["https://app.com"] },
      header: { Origin: "https://app.com" },
    });

    expect(response.header?.["access-control-allow-origin"]).toBe(
      "https://app.com"
    );
  });
});

describe("edge cases", () => {
  test("omits Vary when wildcard origin does not depend on the request Origin", async () => {
    const response = await executeCors();

    expect(response.header?.["vary"]).toBeUndefined();
  });
});
