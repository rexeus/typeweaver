import type { HttpMethod } from "@rexeus/typeweaver-core";
import { assert, expect } from "vitest";
import { Router } from "../../../src/lib/Router.js";
import { noopResponseValidator, noopValidator } from "../../helpers.js";
import type {
  RouteDefinition,
  RouterErrorConfig,
} from "../../../src/lib/Router.js";

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

export const route = (
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

export const routeWithRegisteredMethod = (
  method: string,
  path: string,
  operationId?: string
): RouteDefinition => ({
  ...route(method, path, operationId),
  method: method as HttpMethod,
});

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
