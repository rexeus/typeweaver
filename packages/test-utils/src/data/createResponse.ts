import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { createData } from "./createData";

/**
 * Creates a fully populated test response by composing body and header creators.
 *
 * Similar to {@link createRequest}, but for response objects. Allows tests to
 * create valid responses with sensible defaults while only overriding specific fields.
 *
 * @template TResponse - The specific response type (e.g., `CreateTodoResponse`)
 * @template TBody - Response body type
 * @template THeader - Response header type
 * @param defaultResponse - Base response properties (statusCode)
 * @param creators - Factory functions for body and header
 * @param input - Optional partial overrides for statusCode, body, or header
 * @returns A fully populated response object of type `TResponse`
 */
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
