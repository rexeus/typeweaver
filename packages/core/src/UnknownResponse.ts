import type { IHttpBody } from "./HttpBody.js";
import type { IHttpHeader } from "./HttpHeader.js";
import type { HttpStatusCode } from "./HttpStatusCode.js";
import type { ResponseValidationError } from "./ResponseValidationError.js";

export class UnknownResponseError extends Error {
  public constructor(
    public readonly statusCode: HttpStatusCode,
    public readonly header: IHttpHeader | undefined,
    public readonly body: IHttpBody | undefined,
    public readonly validationError: ResponseValidationError
  ) {
    super(`Unknown response with status code '${statusCode}'`);
    this.name = "UnknownResponseError";
  }
}
