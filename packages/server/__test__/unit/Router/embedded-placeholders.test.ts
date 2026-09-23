import { assert, describe, expect, test } from "vitest";
import {
  AmbiguousPathSegmentError,
  ConflictingPathParameterNameError,
} from "../../../src/lib/errors/index.js";
import { Router } from "../../../src/lib/Router.js";
import { expectMatch, expectNoMatch, route } from "./fixtures.js";

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
