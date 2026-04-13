import type { IHttpBody } from "./HttpBody.js";
import type { IHttpHeader } from "./HttpHeader.js";
import type { HttpMethod } from "./HttpMethod.js";
import type { IHttpParam } from "./HttpParam.js";
import type { IHttpQuery } from "./HttpQuery.js";

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
