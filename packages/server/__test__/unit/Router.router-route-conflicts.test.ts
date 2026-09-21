import { ReservedPathParameterError } from "@rexeus/typeweaver-core";
import type { HttpMethod } from "@rexeus/typeweaver-core";
import { captureError, TestAssertionError } from "test-utils";
import { assert, describe, expect, test } from "vitest";
import {
  AmbiguousPathSegmentError,
  ConflictingPathParameterNameError,
  DuplicateRouteRegistrationError,
} from "../../src/lib/errors/index.js";
import { Router } from "../../src/lib/Router.js";
import { noopResponseValidator, noopValidator } from "../helpers.js";
import type {
  RouteDefinition,
  RouterErrorConfig,
} from "../../src/lib/Router.js";

const defaultConfig: RouterErrorConfig = {
  validateRequests: true,
  validateResponses: true,
  handleHttpResponseErrors: true,
  handleRequestValidationErrors: true,
  handleResponseValidationErrors: true,
  handleUnknownErrors: true,
};

type RouteExpectation = {
  readonly operationId?: string;
  readonly path?: string;
  readonly method?: string;
  readonly params?: Record<string, string>;
};

const route = (
  method: string,
  path: string,
  operationId = `${method.toLowerCase()}${path.replace(/[/:]/g, "_")}`
): RouteDefinition => ({
  operationId,
  method: method.toUpperCase() as HttpMethod,
  path,
  requestValidator: noopValidator,
  responseValidator: noopResponseValidator,
  handler: async () => ({
    statusCode: 200,
    body: { routeId: operationId },
  }),
  routerConfig: defaultConfig,
});

const routeWithRegisteredMethod = (
  method: string,
  path: string,
  operationId?: string
): RouteDefinition => ({
  ...route(method, path, operationId),
  method: method as HttpMethod,
});

const captureDuplicateRouteRegistrationError = (
  action: () => void
): DuplicateRouteRegistrationError => {
  const error = captureError(action);

  if (!(error instanceof DuplicateRouteRegistrationError)) {
    throw new TestAssertionError(
      "Expected DuplicateRouteRegistrationError to be thrown"
    );
  }

  return error;
};

const captureConflictingPathParameterNameError = (
  action: () => void
): ConflictingPathParameterNameError => {
  const error = captureError(action);

  if (!(error instanceof ConflictingPathParameterNameError)) {
    throw new TestAssertionError(
      "Expected ConflictingPathParameterNameError to be thrown"
    );
  }

  return error;
};

const expectMatch = (
  router: Router,
  method: string,
  path: string,
  expected: RouteExpectation = {}
) => {
  const match = router.match(method, path);
  assert(match, `Expected ${method} ${path} to match a route`);

  if (expected.operationId !== undefined) {
    expect(match.route.operationId).toBe(expected.operationId);
  }
  if (expected.path !== undefined) {
    expect(match.route.path).toBe(expected.path);
  }
  if (expected.method !== undefined) {
    expect(match.route.method).toBe(expected.method);
  }
  if (expected.params !== undefined) {
    expect(match.params).toEqual(expected.params);
  }

  return match;
};

const expectNoMatch = (router: Router, method: string, path: string) => {
  expect(router.match(method, path)).toBeUndefined();
};

describe("Router route conflicts", () => {
  test("rejects duplicate method and path registrations", () => {
    const router = new Router();
    router.add(route("GET", "/todos"));

    const error = captureDuplicateRouteRegistrationError(() =>
      router.add(route("GET", "/todos"))
    );

    expect(error).toEqual(
      expect.objectContaining({
        method: "GET",
        path: "/todos",
      })
    );
  });

  test("rejects duplicate routes whose method differs only by case", () => {
    const router = new Router();
    router.add(route("GET", "/todos"));

    const error = captureDuplicateRouteRegistrationError(() =>
      router.add(routeWithRegisteredMethod("get", "/todos"))
    );

    expect(error).toEqual(
      expect.objectContaining({
        method: "GET",
        path: "/todos",
      })
    );
  });

  test("rejects duplicate parameterized routes", () => {
    const router = new Router();
    router.add(route("GET", "/todos/:todoId"));

    const error = captureDuplicateRouteRegistrationError(() =>
      router.add(route("GET", "/todos/:todoId"))
    );

    expect(error).toEqual(
      expect.objectContaining({
        method: "GET",
        path: "/todos/:todoId",
      })
    );
  });

  test.each([
    {
      scenario: "duplicate-slash",
      registeredPath: "/todos/",
      duplicatePath: "//todos",
    },
    {
      scenario: "unrooted",
      registeredPath: "/todos/",
      duplicatePath: "todos",
    },
  ])(
    "rejects duplicate $scenario paths after canonicalization",
    ({ registeredPath, duplicatePath }) => {
      const router = new Router();
      router.add(route("GET", registeredPath));

      const error = captureDuplicateRouteRegistrationError(() =>
        router.add(route("GET", duplicatePath))
      );

      expect(error).toEqual(
        expect.objectContaining({
          method: "GET",
          path: duplicatePath,
        })
      );
    }
  );
});

describe("Router compatible route extensions", () => {
  test("allows different methods on the same path", () => {
    const router = new Router();
    router.add(route("GET", "/todos"));

    expect(() => router.add(route("POST", "/todos"))).not.toThrow();
  });

  test("allows extending a parameterized route with the same parameter name", () => {
    const router = new Router();
    router.add(route("GET", "/users/:userId", "get-user"));

    expect(() =>
      router.add(route("GET", "/users/:userId/profile", "get-profile"))
    ).not.toThrow();
    expectMatch(router, "GET", "/users/u1/profile", {
      operationId: "get-profile",
      params: { userId: "u1" },
    });
  });

  test("rejects routes that rename an existing parameter segment", () => {
    const router = new Router();
    router.add(route("GET", "/users/:userId"));

    const error = captureConflictingPathParameterNameError(() =>
      router.add(route("GET", "/users/:id/profile"))
    );

    expect(error).toEqual(
      expect.objectContaining({
        path: "/users/:id/profile",
        existingParameterName: "userId",
        conflictingParameterName: "id",
      })
    );
  });

  test("rejects parameter renames across HTTP methods", () => {
    const router = new Router();
    router.add(route("GET", "/users/:userId"));

    const error = captureConflictingPathParameterNameError(() =>
      router.add(route("POST", "/users/:id"))
    );

    expect(error).toEqual(
      expect.objectContaining({
        path: "/users/:id",
        existingParameterName: "userId",
        conflictingParameterName: "id",
      })
    );
  });
});

describe("Router reserved and generated path parameters", () => {
  test("rejects a ':__proto__' placeholder at registration", () => {
    const router = new Router();

    expect(() => router.add(route("GET", "/todos/:__proto__"))).toThrow(
      ReservedPathParameterError
    );
  });

  test.each(["/files/:__proto__.:format", "/:__proto__-suffix"])(
    "rejects the reserved placeholder in %s at registration",
    (path: string) => {
      const router = new Router();

      expect(() => router.add(route("GET", path))).toThrow(
        ReservedPathParameterError
      );
    }
  );

  test("preserves ordinary embedded placeholders", () => {
    const router = new Router();
    router.add(route("GET", "/files/:fileId.:format"));

    const match = router.match("GET", "/files/report.json");

    assert(match);
  });

  test("keeps constructor and toString params as own properties", () => {
    const router = new Router();
    router.add(route("GET", "/todos/:constructor/:toString"));

    const match = router.match("GET", "/todos/a/b");
    assert(match);

    expect(
      Object.getOwnPropertyDescriptor(match.params, "constructor")?.value
    ).toBe("a");
    expect(
      Object.getOwnPropertyDescriptor(match.params, "toString")?.value
    ).toBe("b");
  });
});

describe("Router embedded segment placeholders", () => {
  test("extracts multiple placeholders from one segment", () => {
    const router = new Router();
    router.add(route("GET", "/files/:fileId.:format", "get-file"));

    expectMatch(router, "GET", "/files/report.json", {
      operationId: "get-file",
      params: { fileId: "report", format: "json" },
    });
  });

  test("extracts placeholders around punctuation separators", () => {
    const router = new Router();
    router.add(route("GET", "/assets/:name-:hash.:ext", "get-asset"));

    expectMatch(router, "GET", "/assets/logo-abc123.svg", {
      operationId: "get-asset",
      params: { name: "logo", hash: "abc123", ext: "svg" },
    });
  });

  test("decodes embedded placeholder values", () => {
    const router = new Router();
    router.add(route("GET", "/files/:fileId.:format", "get-file"));

    expectMatch(router, "GET", "/files/hello%20world.json", {
      operationId: "get-file",
      params: { fileId: "hello world", format: "json" },
    });
  });

  test("preserves encoded embedded delimiters inside placeholder values", () => {
    const router = new Router();
    router.add(route("GET", "/files/:fileId.:format", "get-file"));

    expectMatch(router, "GET", "/files/quarter%2E1.json", {
      operationId: "get-file",
      params: { fileId: "quarter.1", format: "json" },
    });
  });

  test("keeps encoded dot-segment embedded values raw", () => {
    const router = new Router();
    router.add(route("GET", "/files/:fileId.:format", "get-file"));

    expectMatch(router, "GET", "/files/%2e%2e.json", {
      operationId: "get-file",
      params: { fileId: "%2e%2e", format: "json" },
    });
  });

  test("lets the trailing embedded placeholder capture the remainder", () => {
    const router = new Router();
    router.add(route("GET", "/files/:fileId.:format", "get-file"));

    expectMatch(router, "GET", "/files/report.json.extra", {
      operationId: "get-file",
      params: { fileId: "report", format: "json.extra" },
    });
  });

  test("prefers the more specific embedded pattern over a bare parameter", () => {
    const router = new Router();
    router.add(route("GET", "/files/:fileId", "bare-file"));
    router.add(route("GET", "/files/:fileId.:format", "formatted-file"));

    expectMatch(router, "GET", "/files/report.json", {
      operationId: "formatted-file",
      params: { fileId: "report", format: "json" },
    });
    expectMatch(router, "GET", "/files/report", {
      operationId: "bare-file",
      params: { fileId: "report" },
    });
  });

  test("rejects ambiguous adjacent placeholders", () => {
    const router = new Router();

    expect(() => router.add(route("GET", "/files/:name:format"))).toThrow(
      AmbiguousPathSegmentError
    );
  });

  test("rejects a rename of the same embedded shape", () => {
    const router = new Router();
    router.add(route("GET", "/files/:fileId.:format"));

    expect(() => router.add(route("GET", "/files/:name.:ext"))).toThrow(
      ConflictingPathParameterNameError
    );
  });

  test("rejects segments that do not match the embedded pattern", () => {
    const router = new Router();
    router.add(route("GET", "/files/:fileId.:format", "get-file"));

    expectNoMatch(router, "GET", "/files/report");
    expectNoMatch(router, "GET", "/files/.json");
  });

  test("keeps constructor and toString embedded params as own properties", () => {
    const router = new Router();
    router.add(route("GET", "/x/:constructor.:toString", "get-x"));

    const match = router.match("GET", "/x/a.b");
    assert(match);

    expect(
      Object.getOwnPropertyDescriptor(match.params, "constructor")?.value
    ).toBe("a");
    expect(
      Object.getOwnPropertyDescriptor(match.params, "toString")?.value
    ).toBe("b");
  });
});
