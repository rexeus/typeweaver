import type { IHttpBody } from "./HttpBody";
import type { IHttpHeader } from "./HttpHeader";
import type { HttpMethod } from "./HttpMethod";
import type { IHttpParam } from "./HttpParam";
import type { IHttpQuery } from "./HttpQuery";

export type IHttpRequest<
  Header extends IHttpHeader = IHttpHeader,
  Param extends IHttpParam = IHttpParam,
  Query extends IHttpQuery = IHttpQuery,
  Body extends IHttpBody = IHttpBody,
> = {
  body?: Body;
  query?: Query;
  param?: Param;
  header?: Header;
  path: string;
  method: HttpMethod;
};
