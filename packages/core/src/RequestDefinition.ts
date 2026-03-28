import type { HttpBodySchema } from "./HttpBody";
import type { HttpHeaderSchema } from "./HttpHeader";
import type { HttpParamSchema } from "./HttpParam";
import type { HttpQuerySchema } from "./HttpQuery";

export type RequestDefinition<
  THeader extends HttpHeaderSchema | undefined = HttpHeaderSchema | undefined,
  TParam extends HttpParamSchema | undefined = HttpParamSchema | undefined,
  TQuery extends HttpQuerySchema | undefined = HttpQuerySchema | undefined,
  TBody extends HttpBodySchema | undefined = HttpBodySchema | undefined,
> = {
  readonly header?: THeader;
  readonly param?: TParam;
  readonly query?: TQuery;
  readonly body?: TBody;
};
