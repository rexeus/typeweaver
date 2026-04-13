export class DuplicateRouteError extends Error {
  public constructor(method: string, path: string, normalizedPath: string) {
    super(
      `Route '${method} ${path}' conflicts with an existing route using normalized path '${normalizedPath}'.`
    );
    this.name = "DuplicateRouteError";
  }
}
