import { pathMatcher } from "../PathMatcher";
import { defineMiddleware } from "../TypedMiddleware";
import type { TypedMiddleware } from "../TypedMiddleware";

/**
 * Restricts a middleware to only run on paths matching the given patterns.
 *
 * Accepts the same pattern syntax as {@link pathMatcher}: exact (`"/users"`),
 * prefix (`"/api/*"`), and parameterized (`"/users/:id"`).
 *
 * Only accepts non-state middleware (`TypedMiddleware<{}, {}>`) to preserve
 * TypeWeaver's compile-time state guarantees — skipping a state-providing
 * middleware would leave downstream consumers with missing state.
 *
 * @example
 * ```typescript
 * app.use(scoped(["/api/*"], cors({ origin: "https://app.com" })));
 * ```
 */
export function scoped(
  paths: readonly string[],
  middleware: TypedMiddleware<{}, {}>
): TypedMiddleware<{}, {}> {
  const matchers = paths.map(pathMatcher);

  return defineMiddleware(async (ctx, next) => {
    if (!matchers.some(match => match(ctx.request.path))) {
      return next();
    }
    return middleware.handler(ctx, next);
  });
}

/**
 * Runs a middleware on all paths *except* those matching the given patterns.
 *
 * The inverse of {@link scoped}. Same pattern syntax and type constraint.
 *
 * @example
 * ```typescript
 * app.use(except(["/health", "/ready"], logger()));
 * ```
 */
export function except(
  paths: readonly string[],
  middleware: TypedMiddleware<{}, {}>
): TypedMiddleware<{}, {}> {
  const matchers = paths.map(pathMatcher);

  return defineMiddleware(async (ctx, next) => {
    if (matchers.some(match => match(ctx.request.path))) {
      return next();
    }
    return middleware.handler(ctx, next);
  });
}
