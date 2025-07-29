import { HttpMethod } from "@rexeus/typeweaver-core";

export class InvalidHttpMethodError extends Error {
  public constructor(
    public readonly operationId: string,
    public readonly method: string,
    public readonly file: string
  ) {
    const validMethods = Object.values(HttpMethod).join(", ");
    super(
      `Invalid HTTP method '${method}' in operation '${operationId}' at \`${file}\`\n` +
        `  Valid methods: ${validMethods}`
    );
  }
}
