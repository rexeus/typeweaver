import type { IHttpBody } from "./HttpBody";
import type { IHttpHeader } from "./HttpHeader";
import type { HttpStatusCode } from "./HttpStatusCode";

export type IHttpResponse<
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = IHttpBody,
> = {
  readonly statusCode: HttpStatusCode;
  readonly header?: Header;
  readonly body?: Body;
};

export type ITypedHttpResponse<
  TypeName extends string = string,
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = IHttpBody,
> = IHttpResponse<Header, Body> & {
  readonly type: TypeName;
};

export const isTypedHttpResponse = (
  value: unknown
): value is ITypedHttpResponse =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof (value as Record<string, unknown>).type === "string" &&
  "statusCode" in value;
