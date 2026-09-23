import { ReservedPathParameterError } from "@rexeus/typeweaver-core";
import { captureError, TestAssertionError } from "test-utils";
import { assert, describe, expect, test } from "vitest";
import {
  ConflictingPathParameterNameError,
  DuplicateRouteRegistrationError,
} from "../../../src/lib/errors/index.js";
import { Router } from "../../../src/lib/Router.js";
import { expectMatch, route, routeWithRegisteredMethod } from "./fixtures.js";

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
