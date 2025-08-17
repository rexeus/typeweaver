import type { IHttpRequest } from "@rexeus/typeweaver-core";
import { createData } from "./createData";

export function createRequest<
  TRequest extends IHttpRequest,
  TBody,
  THeader,
  TParam,
  TQuery,
>(
  defaultRequest: Omit<TRequest, "body" | "header" | "param" | "query">,
  creators: {
    body?: (input?: Partial<TBody>) => TBody;
    header?: (input?: Partial<THeader>) => THeader;
    param?: (input?: Partial<TParam>) => TParam;
    query?: (input?: Partial<TQuery>) => TQuery;
  },
  input: {
    path?: string;
    body?: Partial<TBody>;
    header?: Partial<THeader>;
    param?: Partial<TParam>;
    query?: Partial<TQuery>;
  } = {}
): TRequest {
  const defaults: Partial<TRequest> = {
    ...defaultRequest,
  } as Partial<TRequest>;
  if (creators.body) (defaults as any).body = creators.body();
  if (creators.header) (defaults as any).header = creators.header();
  if (creators.param) (defaults as any).param = creators.param();
  if (creators.query) (defaults as any).query = creators.query();

  const overrides: Partial<TRequest> = {};
  if (input.path !== undefined) (overrides as any).path = input.path;
  if (input.body && creators.body)
    (overrides as any).body = creators.body(input.body);
  if (input.header && creators.header)
    (overrides as any).header = creators.header(input.header);
  if (input.param && creators.param)
    (overrides as any).param = creators.param(input.param);
  if (input.query && creators.query)
    (overrides as any).query = creators.query(input.query);

  return createData(defaults as TRequest, overrides);
}
