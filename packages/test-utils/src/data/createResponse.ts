import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { createData } from "./createData";

export function createResponse<TResponse extends IHttpResponse, TBody, THeader>(
  defaultResponse: Omit<TResponse, "body" | "header">,
  creators: {
    body?: (input?: Partial<TBody>) => TBody;
    header?: (input?: Partial<THeader>) => THeader;
  },
  input: {
    statusCode?: number;
    body?: Partial<TBody>;
    header?: Partial<THeader>;
  } = {}
): TResponse {
  const defaults: Partial<TResponse> = {
    ...defaultResponse,
  } as Partial<TResponse>;
  if (creators.body) (defaults as any).body = creators.body();
  if (creators.header) (defaults as any).header = creators.header();

  const overrides: Partial<TResponse> = {};
  if (input.statusCode !== undefined)
    (overrides as any).statusCode = input.statusCode;
  if (input.body && creators.body)
    (overrides as any).body = creators.body(input.body);
  if (input.header && creators.header)
    (overrides as any).header = creators.header(input.header);

  return createData(defaults as TResponse, overrides);
}
