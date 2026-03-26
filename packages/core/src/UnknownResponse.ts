import type { IHttpBody } from "./HttpBody";
import type { IHttpHeader } from "./HttpHeader";
import type { ITaggedHttpResponse } from "./HttpResponse";
import type { ResponseValidationError } from "./ResponseValidationError";

export type UnknownResponse<
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = unknown,
> = ITaggedHttpResponse<"Unknown", Header, Body> & {
  readonly validationError: ResponseValidationError;
};

export const createUnknownResponse = <
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = unknown,
>(
  statusCode: UnknownResponse<Header, Body>["statusCode"],
  header: Header,
  body: Body,
  validationError: ResponseValidationError
): UnknownResponse<Header, Body> => ({
  _tag: "Unknown",
  statusCode,
  header,
  body,
  validationError,
});
