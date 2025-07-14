import { HttpMethod } from "@rexeus/typeweaver-core";

export class DuplicateRouteError extends Error {
  public constructor(
    public readonly path: string,
    public readonly method: HttpMethod,
    public readonly firstOperationId: string,
    public readonly firstFile: string,
    public readonly duplicateOperationId: string,
    public readonly duplicateFile: string
  ) {
    super(
      `Duplicate route '${method} ${path}' found.\n` +
      `  First defined by operation '${firstOperationId}' in: \`${firstFile}\`\n` +
      `  Duplicate defined by operation '${duplicateOperationId}' in: \`${duplicateFile}\``
    );
  }
}