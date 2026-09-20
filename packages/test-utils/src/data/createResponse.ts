import type { IHttpResponse } from "@rexeus/typeweaver-core";
import { createData } from "./createData.js";
import type { DataOverrides } from "./createData.js";

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
  defaultResponse: Omit<TResponse, "type" | "body" | "header">,
  creators: {
    body?: (input?: DataOverrides<TBody>) => TBody;
    header?: (input?: DataOverrides<THeader>) => THeader;
  },
  input: {
    statusCode?: number;
    body?: DataOverrides<TBody>;
    header?: DataOverrides<THeader>;
  } = {}
): Omit<TResponse, "type"> {
  const defaults: Partial<TResponse> = {
    ...defaultResponse,
  } as Partial<TResponse>;
  const mutableDefaults = defaults as Record<string, unknown>;
  if (creators.body) mutableDefaults["body"] = creators.body();
  if (creators.header) mutableDefaults["header"] = creators.header();

  const overrides: Record<string, unknown> = {};
  if (input.statusCode !== undefined)
    overrides["statusCode"] = input.statusCode;
  if (input.body !== undefined && creators.body)
    overrides["body"] = creators.body(input.body);
  if (input.header !== undefined && creators.header)
    overrides["header"] = creators.header(input.header);

  return createData(
    defaults as TResponse,
    overrides as DataOverrides<TResponse>
  ) as Omit<TResponse, "type">;
}
