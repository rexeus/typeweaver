import { pathMatcher } from "../PathMatcher.js";
import { defineMiddleware } from "../TypedMiddleware.js";
import type { TypedMiddleware } from "../TypedMiddleware.js";

type NoProvidedState = Record<string, never>;

/**
 * Restricts a middleware to only run on paths matching the given patterns.
 *
 * Accepts the same pattern syntax as {@link pathMatcher}: exact (`"/users"`),
 * prefix (`"/api/*"`), and parameterized (`"/users/:id"`).
 *
 * Only accepts non-state-providing middleware to preserve
 * TypeWeaver's compile-time state guarantees — skipping a state-providing
 * middleware would leave downstream consumers with missing state.
 * Any upstream state requirements declared by the wrapped middleware are
 * preserved on the returned middleware descriptor.
 *
 * @example
 * ```typescript
 * app.use(scoped(["/api/*"], cors({ origin: "https://app.com" })));
 * ```
 */
export function scoped<TRequires extends Record<string, unknown>>(
  paths: readonly string[],
  middleware: TypedMiddleware<NoProvidedState, TRequires>,
): TypedMiddleware<{}, TRequires> {
  const matchers = paths.map(pathMatcher);

  return defineMiddleware<{}, TRequires>(async (ctx, next) => {
    if (!matchers.some((match) => match(ctx.request.path))) {
      return next();
    }
    return middleware.handler(ctx, next);
  });
}

/**
 * Runs a middleware on all paths *except* those matching the given patterns.
 *
 * The inverse of {@link scoped}. Same pattern syntax and type constraints,
 * including preservation of wrapped middleware state requirements.
 *
 * @example
 * ```typescript
 * app.use(except(["/health", "/ready"], logger()));
 * ```
 */
export function except<TRequires extends Record<string, unknown>>(
  paths: readonly string[],
  middleware: TypedMiddleware<NoProvidedState, TRequires>,
): TypedMiddleware<{}, TRequires> {
  const matchers = paths.map(pathMatcher);

  return defineMiddleware<{}, TRequires>(async (ctx, next) => {
    if (matchers.some((match) => match(ctx.request.path))) {
      return next();
    }
    return middleware.handler(ctx, next);
  });
}
