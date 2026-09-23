import { describe, test } from "vitest";
import { Router } from "../../../src/lib/Router.js";
import { expectMatch, expectNoMatch, route } from "./fixtures.js";

describe("Router URL decoding", () => {
  test.each([
    {
      scenario: "space",
      requestPath: "/todos/hello%20world",
      expected: { todoId: "hello world" },
    },
    {
      scenario: "unicode",
      requestPath: "/todos/caf%C3%A9",
      expected: { todoId: "café" },
    },
  ])(
    "decodes a normal encoded $scenario in params",
    ({ requestPath, expected }) => {
      const router = new Router();
      router.add(route("GET", "/todos/:todoId", "get-todo"));

      expectMatch(router, "GET", requestPath, {
        operationId: "get-todo",
        params: expected,
      });
    }
  );

  test("keeps malformed encoded params as raw segments", () => {
    const router = new Router();
    router.add(route("GET", "/todos/:todoId", "get-todo"));

    expectMatch(router, "GET", "/todos/%ZZ", {
      operationId: "get-todo",
      params: { todoId: "%ZZ" },
    });
  });

  test("matches static segments without decoding them", () => {
    const router = new Router();
    router.add(route("GET", "/todos", "list-todos"));

    expectNoMatch(router, "GET", "/%74odos");
  });

  test.each([
    {
      scenario: "encoded parent segment",
      requestPath: "/files/%2e%2e",
      expected: { fileId: "%2e%2e" },
    },
    {
      scenario: "encoded current segment",
      requestPath: "/files/%2e",
      expected: { fileId: "%2e" },
    },
    {
      scenario: "double-encoded parent segment",
      requestPath: "/files/%252e%252e",
      expected: { fileId: "%2e%2e" },
    },
  ])(
    "keeps a $scenario from becoming a dot segment",
    ({ requestPath, expected }) => {
      const router = new Router();
      router.add(route("GET", "/files/:fileId", "get-file"));

      expectMatch(router, "GET", requestPath, {
        operationId: "get-file",
        params: expected,
      });
    }
  );
});

describe("Router encoded separators and traversal segments", () => {
  test.each([
    {
      scenario: "forward slash",
      requestPath: "/files/folder%2Ffile",
      expected: { fileId: "folder%2Ffile" },
    },
    {
      scenario: "backslash",
      requestPath: "/files/folder%5Cfile",
      expected: { fileId: "folder%5Cfile" },
    },
  ])(
    "keeps a non-traversal encoded $scenario separator as a raw param segment",
    ({ requestPath, expected }) => {
      const router = new Router();
      router.add(route("GET", "/files/:fileId", "get-file"));

      expectMatch(router, "GET", requestPath, {
        operationId: "get-file",
        params: expected,
      });
    }
  );

  test.each([
    {
      scenario: "forward slash traversal payload",
      requestPath: "/files/%2e%2e%2fsecret",
      expected: { fileId: "%2e%2e%2fsecret" },
    },
    {
      scenario: "backslash traversal payload",
      requestPath: "/files/%2e%2e%5csecret",
      expected: { fileId: "%2e%2e%5csecret" },
    },
  ])(
    "keeps an encoded $scenario as a raw param segment",
    ({ requestPath, expected }) => {
      const router = new Router();
      router.add(route("GET", "/files/:fileId", "get-file"));

      expectMatch(router, "GET", requestPath, {
        operationId: "get-file",
        params: expected,
      });
    }
  );
});

describe("Router path canonicalization", () => {
  test("matches the root route for root-like request paths", () => {
    const router = new Router();
    router.add(route("GET", "/", "root"));

    expectMatch(router, "GET", "/", { operationId: "root", params: {} });
    expectMatch(router, "GET", "//", { operationId: "root", params: {} });
  });

  test("rejects child paths for the root route", () => {
    const router = new Router();
    router.add(route("GET", "/", "root"));

    expectNoMatch(router, "GET", "/todos");
  });

  test("matches trailing-slash requests for routes registered without one", () => {
    const router = new Router();
    router.add(route("GET", "/todos", "list-todos"));

    expectMatch(router, "GET", "/todos/", {
      operationId: "list-todos",
      params: {},
    });
  });

  test("matches non-trailing requests for routes registered with trailing slashes", () => {
    const router = new Router();
    router.add(route("GET", "/todos/", "list-todos"));

    expectMatch(router, "GET", "/todos", {
      operationId: "list-todos",
      path: "/todos/",
      params: {},
    });
  });

  test("matches duplicate slashes in registered and requested paths", () => {
    const router = new Router();
    router.add(route("GET", "//api//todos//:todoId//", "get-todo"));

    expectMatch(router, "GET", "/api/todos//t1/", {
      operationId: "get-todo",
      params: { todoId: "t1" },
    });
  });

  test("matches empty paths as the root route", () => {
    const router = new Router();
    router.add(route("GET", "/", "root"));

    expectMatch(router, "GET", "", { operationId: "root", params: {} });
  });

  test("matches unrooted request paths as rooted equivalents", () => {
    const router = new Router();
    router.add(route("GET", "/todos/:todoId", "get-todo"));

    expectMatch(router, "GET", "todos/t1", {
      operationId: "get-todo",
      params: { todoId: "t1" },
    });
  });

  test("registers unrooted paths as rooted equivalents", () => {
    const router = new Router();
    router.add(route("GET", "todos/:todoId", "get-todo"));

    expectMatch(router, "GET", "/todos/t1", {
      operationId: "get-todo",
      path: "todos/:todoId",
      params: { todoId: "t1" },
    });
  });

  test("returns undefined when no routes are registered", () => {
    const router = new Router();

    expectNoMatch(router, "GET", "/anything");
  });
});
