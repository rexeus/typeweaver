import type { HttpBodySchema } from "./HttpBody.js";
import type { HttpRequestHeaderSchema } from "./HttpHeader.js";
import type { HttpParamSchema } from "./HttpParam.js";
import type { HttpQuerySchema } from "./HttpQuery.js";

export type RequestDefinition<
  THeader extends HttpRequestHeaderSchema | undefined =
    | HttpRequestHeaderSchema
    | undefined,
  TParam extends HttpParamSchema | undefined = HttpParamSchema | undefined,
  TQuery extends HttpQuerySchema | undefined = HttpQuerySchema | undefined,
  TBody extends HttpBodySchema | undefined = HttpBodySchema | undefined,
> = {
  readonly header?: THeader;
  readonly param?: TParam;
  readonly query?: TQuery;
  readonly body?: TBody;
};
