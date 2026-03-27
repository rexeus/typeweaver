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

export type ITaggedHttpResponse<
  Tag extends string = string,
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = IHttpBody,
> = IHttpResponse<Header, Body> & {
  readonly _tag: Tag;
};

export const isTaggedHttpResponse = (
  value: unknown
): value is ITaggedHttpResponse =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  typeof (value as Record<string, unknown>)._tag === "string" &&
  "statusCode" in value;
