import { HttpResponse } from "./HttpResponse";
import type { IHttpBody } from "./HttpBody";
import type { IHttpHeader } from "./HttpHeader";
import type { HttpStatusCode } from "./HttpStatusCode";
import type { ResponseValidationError } from "./ResponseValidationError";

export class UnknownResponse<
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = unknown,
> extends HttpResponse<Header, Body> {
  public constructor(
    statusCode: HttpStatusCode,
    header: Header,
    body: Body,
    public readonly validationError: ResponseValidationError
  ) {
    super(statusCode, header, body);
  }
}
