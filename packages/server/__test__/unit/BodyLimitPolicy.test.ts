import { describe, expect, test } from "vitest";
import {
  DEFAULT_MAX_BODY_SIZE,
  createFetchBodyLimitPolicy,
  createNodeBodyLimitPolicy,
  getRequestBodyPrevalidation,
  hasSatisfiedBodyLimitPolicy,
  markRequestBodyPrevalidated,
} from "../../src/lib/BodyLimitPolicy.js";

describe("BodyLimitPolicy", () => {
  test("creates the fetch policy factory with the default limit", () => {
    expect(createFetchBodyLimitPolicy()).toEqual({
      maxBodySize: DEFAULT_MAX_BODY_SIZE,
      capability: "unvalidated-request-body",
    });
  });

  test("creates the node policy factory with the provided limit", () => {
    expect(createNodeBodyLimitPolicy(128)).toEqual({
      maxBodySize: 128,
      capability: "prevalidated-request-body",
    });
  });

  test("marks request prevalidation for prevalidated policies", () => {
    const request = new Request("http://localhost/items", {
      method: "POST",
      body: "hello",
    });
    const policy = createNodeBodyLimitPolicy(64);

    markRequestBodyPrevalidated(request, policy);

    expect(getRequestBodyPrevalidation(request)).toEqual({
      maxBodySize: 64,
    });
  });

  test("does not mark request prevalidation for unvalidated policies", () => {
    const request = new Request("http://localhost/items", {
      method: "POST",
      body: "hello",
    });

    markRequestBodyPrevalidated(request, createFetchBodyLimitPolicy(64));

    expect(getRequestBodyPrevalidation(request)).toBeUndefined();
  });

  test("returns false when there is no prevalidation", () => {
    const request = new Request("http://localhost/items", {
      method: "POST",
      body: "hello",
    });

    expect(
      hasSatisfiedBodyLimitPolicy(request, createFetchBodyLimitPolicy(64))
    ).toBe(false);
  });

  test("treats an equal prevalidated limit as satisfied", () => {
    const request = new Request("http://localhost/items", {
      method: "POST",
      body: "hello",
    });
    const policy = createNodeBodyLimitPolicy(64);

    markRequestBodyPrevalidated(request, policy);

    expect(
      hasSatisfiedBodyLimitPolicy(request, createFetchBodyLimitPolicy(64))
    ).toBe(true);
  });

  test("treats a stricter prevalidated limit as satisfying a looser fetch policy", () => {
    const request = new Request("http://localhost/items", {
      method: "POST",
      body: "hello",
    });

    markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(32));

    expect(
      hasSatisfiedBodyLimitPolicy(request, createFetchBodyLimitPolicy(64))
    ).toBe(true);
  });

  test("treats a looser prevalidated limit as not satisfying a stricter fetch policy", () => {
    const request = new Request("http://localhost/items", {
      method: "POST",
      body: "hello",
    });

    markRequestBodyPrevalidated(request, createNodeBodyLimitPolicy(64));

    expect(
      hasSatisfiedBodyLimitPolicy(request, createFetchBodyLimitPolicy(32))
    ).toBe(false);
  });
});
