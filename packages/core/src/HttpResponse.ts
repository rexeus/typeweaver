import { HttpStatusCode } from "./HttpStatusCode.js";
import type { IHttpBody } from "./HttpBody.js";
import type { IHttpHeader } from "./HttpHeader.js";

export type IHttpResponse<
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = IHttpBody,
> = {
  readonly statusCode: HttpStatusCode;
  readonly header?: Header;
  readonly body?: Body;
};

export type ITypedHttpResponseHeader =
  | Record<string, string | string[] | undefined>
  | undefined;

export type ITypedHttpResponse<
  TypeName extends string = string,
  StatusCode extends HttpStatusCode = HttpStatusCode,
  Header extends ITypedHttpResponseHeader = ITypedHttpResponseHeader,
  Body extends IHttpBody | undefined = IHttpBody | undefined,
> = {
  readonly type: TypeName;
  readonly statusCode: StatusCode;
  readonly body: Body;
} & ([Header] extends [undefined]
  ? { readonly header?: undefined }
  : [ITypedHttpResponseHeader] extends [Header]
    ? { readonly header?: Header }
    : { readonly header: Header });
