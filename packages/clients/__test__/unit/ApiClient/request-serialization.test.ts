import { HttpMethod } from "@rexeus/typeweaver-core";
import type { ClientHttpHeader } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import { NetworkError } from "../../../src/lib/NetworkError.js";
import {
  anUncheckedCommand,
  createClient,
  getFetchCall,
  resolvedFetch,
  sendRaw,
  TestRequestCommand,
} from "./fixtures.js";

describe("ApiClient request serialization", () => {
  test("merges default headers while request headers take precedence", async () => {
    const { mockFetch } = await sendRaw(
      {
        header: {
          Authorization: "Bearer request",
          "X-Request": "request",
        },
      },
      {
        defaultHeaders: {
          Authorization: "Bearer default",
          "X-Default": "default",
        },
      }
    );

    expect(getFetchCall(mockFetch).init.headers).toStrictEqual({
      Authorization: "Bearer request",
      "X-Default": "default",
      "X-Request": "request",
    });
  });

  test.each([
    { case: "undefined", body: undefined },
    { case: "null", body: null },
  ])("omits $case request bodies", async ({ body }) => {
    const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

    expect(getFetchCall(mockFetch).init.body).toBeUndefined();
  });

  test("sends string bodies as-is", async () => {
    const { mockFetch } = await sendRaw({
      method: HttpMethod.POST,
      body: "hello",
    });

    expect(getFetchCall(mockFetch).init.body).toBe("hello");
  });

  test("JSON-stringifies plain object bodies", async () => {
    const body = { title: "Write tests", completed: false };

    const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

    expect(getFetchCall(mockFetch).init.body).toBe(JSON.stringify(body));
  });

  test.each([
    { case: "plain object", body: { title: "Write tests" } },
    { case: "array", body: [{ title: "Write tests" }] },
  ])(
    "adds application/json content-type for JSON-stringified $case bodies",
    async ({ body }) => {
      const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

      expect(getFetchCall(mockFetch).init.headers).toStrictEqual({
        "Content-Type": "application/json",
      });
    }
  );
});

describe("ApiClient request content types", () => {
  test("preserves unrelated headers when adding JSON content-type", async () => {
    const { mockFetch } = await sendRaw({
      method: HttpMethod.POST,
      header: { Authorization: "Bearer token" },
      body: { title: "Write tests" },
    });

    expect(getFetchCall(mockFetch).init.headers).toStrictEqual({
      Authorization: "Bearer token",
      "Content-Type": "application/json",
    });
  });

  test.each([
    { case: "true boolean", body: true, expectedBody: "true" },
    { case: "positive number", body: 42, expectedBody: "42" },
    { case: "zero", body: 0, expectedBody: "0" },
  ])(
    "adds application/json content-type for JSON-stringified $case bodies",
    async ({ body, expectedBody }) => {
      const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

      const { init } = getFetchCall(mockFetch);
      expect(init.body).toBe(expectedBody);
      expect(init.headers).toStrictEqual({
        "Content-Type": "application/json",
      });
    }
  );

  test.each([
    {
      case: "canonical",
      header: {
        "Content-Type": "application/vnd.api+json",
      } as ClientHttpHeader,
    },
    {
      case: "lowercase",
      header: {
        "content-type": "application/vnd.api+json",
      } as ClientHttpHeader,
    },
  ])(
    "preserves user-provided $case content-type for JSON bodies",
    async ({ header }) => {
      const { mockFetch } = await sendRaw({
        method: HttpMethod.POST,
        header,
        body: { title: "Write tests" },
      });

      expect(getFetchCall(mockFetch).init.headers).toStrictEqual(header);
    }
  );
});

describe("ApiClient request serialization failures", () => {
  test("throws native TypeError for circular object bodies before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    const command = new TestRequestCommand({
      method: HttpMethod.POST,
      body: circular,
    });

    await expect(client.send(command)).rejects.toSatisfy((error: unknown) => {
      return error instanceof TypeError && !(error instanceof NetworkError);
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test.each([
    { case: "Blob", body: new Blob(["hello"], { type: "text/plain" }) },
    { case: "ArrayBuffer", body: new ArrayBuffer(8) },
    { case: "Uint8Array", body: new Uint8Array([1, 2, 3]) },
    { case: "FormData", body: new FormData() },
    { case: "URLSearchParams", body: new URLSearchParams({ key: "value" }) },
    {
      case: "ReadableStream",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
    },
  ])("passes native $case bodies through as-is", async ({ body }) => {
    const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

    expect(getFetchCall(mockFetch).init.body).toBe(body);
  });

  test.each([
    { case: "undefined", body: undefined },
    { case: "null", body: null },
    { case: "string", body: "hello" },
    { case: "Blob", body: new Blob(["hello"], { type: "text/plain" }) },
    { case: "ArrayBuffer", body: new ArrayBuffer(8) },
    { case: "Uint8Array", body: new Uint8Array([1, 2, 3]) },
    { case: "FormData", body: new FormData() },
    { case: "URLSearchParams", body: new URLSearchParams({ key: "value" }) },
    {
      case: "ReadableStream",
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]));
          controller.close();
        },
      }),
    },
  ])("does not add content-type for $case bodies", async ({ body }) => {
    const { mockFetch } = await sendRaw({ method: HttpMethod.POST, body });

    expect(getFetchCall(mockFetch).init.headers).toBeUndefined();
  });
});

describe("ApiClient default headers", () => {
  test("treats header names case-insensitively when request headers override defaults", async () => {
    const { mockFetch } = await sendRaw(
      {
        header: {
          authorization: "Bearer request",
        },
      },
      {
        defaultHeaders: {
          Authorization: "Bearer default",
          "X-Default": "default",
        },
      }
    );

    expect([
      ...new Headers(getFetchCall(mockFetch).init.headers).entries(),
    ]).toStrictEqual([
      ["authorization", "Bearer request"],
      ["x-default", "default"],
    ]);
  });
});

describe("ApiClient request header flattening", () => {
  test("passes undefined headers as undefined", async () => {
    const { mockFetch } = await sendRaw({ header: undefined });

    expect(getFetchCall(mockFetch).init.headers).toBeUndefined();
  });

  test("omits undefined header values while preserving empty strings, scalars, and arrays", async () => {
    const header = {
      "X-Empty-Value": "",
      "X-Empty-Array": [],
      "X-Scalar-Value": "present",
      "X-Multi-Value": ["first", "second"],
      "X-Undefined-Value": undefined,
    };

    const { mockFetch } = await sendRaw(anUncheckedCommand({ header }));

    expect(getFetchCall(mockFetch).init.headers).toStrictEqual({
      "X-Empty-Array": "",
      "X-Empty-Value": "",
      "X-Multi-Value": "first, second",
      "X-Scalar-Value": "present",
    });
  });
});
