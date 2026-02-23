import { HttpStatusCode } from "./HttpStatusCode";
import type { IHttpBody } from "./HttpBody";
import type { IHttpHeader } from "./HttpHeader";

export type IHttpResponse<
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = IHttpBody,
> = {
  statusCode: HttpStatusCode;
  header?: Header;
  body?: Body;
};

export class HttpResponse<
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = IHttpBody,
> implements IHttpResponse<Header, Body> {
  public constructor(
    public readonly statusCode: HttpStatusCode,
    public readonly header: Header,
    public readonly body: Body
  ) {}
}
