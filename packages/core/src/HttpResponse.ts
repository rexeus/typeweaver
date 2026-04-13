import type { IHttpBody } from "./HttpBody.js";
import type { IHttpHeader } from "./HttpHeader.js";
import type { HttpStatusCode } from "./HttpStatusCode.js";

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
  StatusCode extends HttpStatusCode = HttpStatusCode,
  Header extends IHttpHeader | undefined = IHttpHeader | undefined,
  Body extends IHttpBody | undefined = IHttpBody | undefined,
> = {
  readonly type: TypeName;
  readonly statusCode: StatusCode;
  readonly header: Header;
  readonly body: Body;
};

export const isTypedHttpResponse = (
  value: unknown
): value is ITypedHttpResponse =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof (value as Record<string, unknown>).type === "string" &&
  "statusCode" in value &&
  typeof (value as Record<string, unknown>).statusCode === "number";
