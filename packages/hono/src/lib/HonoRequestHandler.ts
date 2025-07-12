import type { IHttpRequest, IHttpResponse } from "@rexeus/typeweaver-core";
import type { Context } from "hono";

export type HonoRequestHandler<
  Request extends IHttpRequest,
  Response extends IHttpResponse,
> = (request: Request, context: Context) => Promise<Response>;
