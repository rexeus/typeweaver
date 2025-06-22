import type { IHttpHeader } from "./HttpHeader";
import type { IHttpParam } from "./HttpParam";
import type { IHttpBody } from "./HttpBody";
import type { IHttpQuery } from "./HttpQuery";
import type { HttpMethod } from "./HttpMethod";

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
