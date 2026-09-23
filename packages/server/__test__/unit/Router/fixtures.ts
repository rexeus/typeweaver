import { HttpMethod } from "@rexeus/typeweaver-core";
import { TestAssertionError } from "test-utils";
import { assert, expect } from "vitest";
import { Router } from "../../../src/lib/Router.js";
import {
  callUntyped,
  noopResponseValidator,
  noopValidator,
} from "../../helpers.js";
import type {
  RouteDefinition,
  RouterErrorConfig,
} from "../../../src/lib/routerTypes.js";

export const defaultConfig: RouterErrorConfig = {
  validateRequests: true,
  validateResponses: true,
  handleHttpResponseErrors: true,
  handleRequestValidationErrors: true,
  handleResponseValidationErrors: true,
  handleUnknownErrors: true,
};

export type RouteExpectation = {
  readonly operationId?: string;
  readonly path?: string;
  readonly method?: string;
  readonly params?: Record<string, string>;
};

const toHttpMethod = (method: string): HttpMethod => {
  const httpMethod = Object.values(HttpMethod).find(
    candidate => String(candidate) === method.toUpperCase()
  );
  if (httpMethod === undefined) {
    throw new TestAssertionError(`Expected ${method} to name an HTTP method`);
  }
  return httpMethod;
};

export const route = (
  method: string,
  path: string,
  operationId = `${method.toLowerCase()}${path.replace(/[/:]/g, "_")}`
): RouteDefinition => ({
  operationId,
  method: toHttpMethod(method),
  path,
  requestValidator: noopValidator,
  responseValidator: noopResponseValidator,
  handler: async () => ({
    statusCode: 200,
    body: { routeId: operationId },
  }),
  routerConfig: defaultConfig,
});

/**
 * Registers a route whose method keeps the given casing, which `HttpMethod`
 * cannot express, the way an untyped JavaScript caller registers it.
 */
export const addRouteWithRegisteredMethod = (
  router: Router,
  method: string,
  path: string,
  operationId?: string
): void => {
  callUntyped(router.add.bind(router), {
    ...route(method, path, operationId),
    method,
  });
};

export const expectMatch = (
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

export const expectNoMatch = (router: Router, method: string, path: string) => {
  expect(router.match(method, path)).toBeUndefined();
};
