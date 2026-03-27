import type { IHttpBody } from "./HttpBody";
import type { IHttpHeader } from "./HttpHeader";
import type { HttpStatusCode } from "./HttpStatusCode";
import type { ResponseValidationError } from "./ResponseValidationError";

export class UnknownResponseError extends Error {
  public override readonly name = "UnknownResponseError";

  public constructor(
    public readonly statusCode: HttpStatusCode,
    public readonly header: IHttpHeader | undefined,
    public readonly body: IHttpBody,
    public readonly validationError: ResponseValidationError
  ) {
    super(`Unknown response with status code '${statusCode}'`);
  }
}
