import type { ClientHttpParam } from "@rexeus/typeweaver-core";
import { describe, expect, test } from "vitest";
import {
  anUncheckedCommand,
  createClient,
  expectPathParameterRejection,
  expectRequestSerializationFailure,
  getFetchCall,
  resolvedFetch,
  sendRaw,
  TestRequestCommand,
} from "./fixtures.js";

describe("ApiClient URL construction", () => {
  test.each([
    {
      case: "origin-only base URL with leading slash path",
      baseUrl: "http://localhost:3000",
      path: "/todos",
      expectedUrl: "http://localhost:3000/todos",
    },
    {
      case: "base URL path without trailing slash",
      baseUrl: "http://localhost:3000/api",
      path: "/todos",
      expectedUrl: "http://localhost:3000/api/todos",
    },
    {
      case: "base URL path with trailing slash",
      baseUrl: "http://localhost:3000/api/",
      path: "/todos",
      expectedUrl: "http://localhost:3000/api/todos",
    },
    {
      case: "relative base path",
      baseUrl: "/api",
      path: "/todos",
      expectedUrl: "/api/todos",
    },
    {
      case: "command path without leading slash",
      baseUrl: "http://localhost:3000/api",
      path: "todos",
      expectedUrl: "http://localhost:3000/api/todos",
    },
  ])("joins $case", async ({ baseUrl, path, expectedUrl }) => {
    const { mockFetch } = await sendRaw({ path }, { baseUrl });

    expect(getFetchCall(mockFetch).url).toBe(expectedUrl);
  });
});

describe("ApiClient path parameter replacement", () => {
  test("replaces repeated placeholders with the same encoded value", async () => {
    const { mockFetch } = await sendRaw({
      path: "/orgs/:orgId/items/:orgId",
      param: { orgId: "rexeus/api" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/orgs/rexeus%2Fapi/items/rexeus%2Fapi"
    );
  });

  test("does not partially replace longer placeholder names", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/items/:idPart",
      param: { id: "abc" },
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "id",
      path: "/items/:idPart",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects path parameters when the path has no placeholders before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/todos",
      param: { todoId: "abc" },
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/todos",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("ApiClient path parameter invariants", () => {
  test("rejects extra path parameter not present in the template before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/todos/:todoId",
      param: { todoId: "abc", extra: "ignored" },
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "extra",
      path: "/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects a missing path parameter before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({ path: "/todos/:todoId" });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects an own undefined path parameter before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const param = { todoId: undefined };
    const command = anUncheckedCommand({ path: "/todos/:todoId", param });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects an inherited path parameter before fetch", async () => {
    const inheritedParam: unknown = Object.create({ todoId: "abc" });
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = anUncheckedCommand({
      path: "/todos/:todoId",
      param: inheritedParam,
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("rejects an incomplete path parameter map before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/orgs/:orgId/todos/:todoId",
      param: { orgId: "org_123" },
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "todoId",
      path: "/orgs/:orgId/todos/:todoId",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("ApiClient path parameters", () => {
  test("percent-encodes reserved characters, spaces, percent signs, plus signs, and unicode", async () => {
    const { mockFetch } = await sendRaw({
      path: "/files/:fileId/content",
      param: { fileId: "a b/c?#%+☃" },
    });

    expect(getFetchCall(mockFetch).url).toBe(
      "http://localhost:3000/files/a%20b%2Fc%3F%23%25%2B%E2%98%83/content"
    );
  });

  test("preserves an empty string path parameter value", async () => {
    const { mockFetch } = await sendRaw({
      path: "/todos/:todoId",
      param: { todoId: "" },
    });

    expect(getFetchCall(mockFetch).url).toBe("http://localhost:3000/todos/");
  });

  test("rejects a null path parameter with a null-value serialization error", async () => {
    await expectRequestSerializationFailure(
      anUncheckedCommand({ path: "/todos/:todoId", param: { todoId: null } }),
      {
        location: "path",
        key: "todoId",
        reason: "null-value",
        valueType: "null",
      }
    );
  });

  test.each([".", ".."] as const)(
    "rejects dot-segment path parameter value %s before fetch",
    async fileId => {
      const mockFetch = resolvedFetch();
      const client = createClient(mockFetch);
      const command = new TestRequestCommand({
        path: "/files/:fileId/content",
        param: { fileId },
      });

      await expectPathParameterRejection(client.send(command), {
        paramName: "fileId",
        path: "/files/:fileId/content",
      });
      expect(mockFetch).not.toHaveBeenCalled();
    }
  );

  test.each(["%2E", "%2E%2E", "%2e%2e"] as const)(
    "double-encodes percent-encoded dot-segment %s rather than rejecting",
    async fileId => {
      const { mockFetch } = await sendRaw({
        path: "/files/:fileId/content",
        param: { fileId },
      });

      const url = getFetchCall(mockFetch).url;
      expect(url).toBe(
        `http://localhost:3000/files/${encodeURIComponent(fileId)}/content`
      );
      expect(url).not.toMatch(/\/\.\.?\//);
    }
  );

  test("rejects a __proto__ path parameter without an own value before fetch", async () => {
    const mockFetch = resolvedFetch();
    const client = createClient(mockFetch);
    const command = new TestRequestCommand({
      path: "/items/:__proto__",
      param: {} as ClientHttpParam,
    });

    await expectPathParameterRejection(client.send(command), {
      paramName: "__proto__",
      path: "/items/:__proto__",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
