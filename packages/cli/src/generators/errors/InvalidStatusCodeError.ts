import { HttpStatusCode } from "@rexeus/typeweaver-core";

export class InvalidStatusCodeError extends Error {
  public constructor(
    public readonly statusCode: number,
    public readonly responseName: string,
    public readonly file: string
  ) {
    const validStatusCodes = Object.values(HttpStatusCode).join(", ");
    super(
      `Invalid status code '${statusCode}' in response '${responseName}' at \`${file}\`\n` +
      `  Valid status codes: ${validStatusCodes}`
    );
  }
}