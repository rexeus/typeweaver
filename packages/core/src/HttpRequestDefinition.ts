import type { HttpBodySchema } from "./HttpBody";
import type { HttpHeaderSchema } from "./HttpHeader";
import type { HttpParamSchema } from "./HttpParam";
import type { HttpQuerySchema } from "./HttpQuery";

export type IHttpRequestDefinition<
  THeader extends HttpHeaderSchema | undefined = HttpHeaderSchema | undefined,
  TParam extends HttpParamSchema | undefined = HttpParamSchema | undefined,
  TQuery extends HttpQuerySchema | undefined = HttpQuerySchema | undefined,
  TBody extends HttpBodySchema | undefined = HttpBodySchema | undefined,
> = {
  header?: THeader;
  param?: TParam;
  query?: TQuery;
  body?: TBody;
};

export class HttpRequestDefinition<
  THeader extends HttpHeaderSchema | undefined,
  TParam extends HttpParamSchema | undefined,
  TQuery extends HttpQuerySchema | undefined,
  TBody extends HttpBodySchema | undefined,
> implements IHttpRequestDefinition<THeader, TParam, TQuery, TBody> {
  public readonly header?: THeader;
  public readonly param?: TParam;
  public readonly query?: TQuery;
  public readonly body?: TBody;

  public constructor(
    definition: IHttpRequestDefinition<THeader, TParam, TQuery, TBody>
  ) {
    this.header = definition.header;
    this.param = definition.param;
    this.query = definition.query;
    this.body = definition.body;
  }
}
