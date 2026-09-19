/**
 * Canonical route placeholder-name grammar shared with the generator and the
 * generated clients (`:([A-Za-z0-9_]+)`). A placeholder name ends at the first
 * character outside that class, so `:__proto__.:format` and
 * `:__proto__-suffix` still contain a `:__proto__` placeholder.
 */
const PATH_PARAMETER_PATTERN = /:([A-Za-z0-9_]+)/g;

const RESERVED_PATH_PARAMETERS: readonly string[] = ["__proto__"];

/**
 * Returns the first reserved path parameter name used by a route path, or
 * `undefined` when every placeholder is allowed.
 *
 * Route paths use `:name` segments. `__proto__` is reserved because it cannot
 * be accumulated into an ordinary own parameter map.
 */
export const findReservedPathParameter = (path: string): string | undefined => {
  for (const match of path.matchAll(PATH_PARAMETER_PATTERN)) {
    const parameterName = match[1];

    if (
      parameterName !== undefined &&
      RESERVED_PATH_PARAMETERS.includes(parameterName)
    ) {
      return parameterName;
    }
  }

  return undefined;
};

/**
 * Thrown when an operation declares a reserved route placeholder.
 */
export class ReservedPathParameterError extends Error {
  public readonly path: string;
  public readonly parameterName: string;

  public constructor(path: string, parameterName: string) {
    super(`Path parameter ':${parameterName}' is reserved in '${path}'.`);
    this.name = "ReservedPathParameterError";
    this.path = path;
    this.parameterName = parameterName;
  }
}
