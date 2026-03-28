import { HttpMethod } from "@rexeus/typeweaver-core";

/**
 * HTTP method priority for route ordering.
 * Lower numbers = higher priority (sorted first).
 */
const METHOD_PRIORITY: Record<string, number> = {
  [HttpMethod.GET]: 1,
  [HttpMethod.POST]: 2,
  [HttpMethod.PUT]: 3,
  [HttpMethod.PATCH]: 4,
  [HttpMethod.DELETE]: 5,
  [HttpMethod.OPTIONS]: 6,
  [HttpMethod.HEAD]: 7,
};

/**
 * Returns the sort priority for an HTTP method.
 * Unrecognized methods default to priority 999.
 */
export const getMethodPriority = (method: string): number =>
  METHOD_PRIORITY[method] ?? 999;

/**
 * Compares two path segments for route ordering.
 * Returns negative if a should come before b, positive if after.
 *
 * Order: static segments before parameters, then alphabetically.
 */
const comparePathSegments = (a: string, b: string): number => {
  const aIsParam = a.startsWith(":");
  const bIsParam = b.startsWith(":");

  if (aIsParam !== bIsParam) {
    return aIsParam ? 1 : -1;
  }

  return a.localeCompare(b);
};

/**
 * Compares two routes for ordering.
 * Routes are sorted by:
 * 1. Path depth (shallow to deep)
 * 2. Static segments before parameters
 * 3. Alphabetical within same segment type
 * 4. HTTP method priority
 */
export const compareRoutes = (
  a: { method: string; path: string },
  b: { method: string; path: string }
): number => {
  const aSegments = a.path.split("/").filter(Boolean);
  const bSegments = b.path.split("/").filter(Boolean);

  if (aSegments.length !== bSegments.length) {
    return aSegments.length - bSegments.length;
  }

  for (let i = 0; i < aSegments.length; i++) {
    const cmp = comparePathSegments(aSegments[i]!, bSegments[i]!);
    if (cmp !== 0) {
      return cmp;
    }
  }

  return getMethodPriority(a.method) - getMethodPriority(b.method);
};