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
  input?: {
    statusCode?: number;
    body?: DataOverrides<TBody>;
    header?: DataOverrides<THeader>;
  }
): Omit<TResponse, "type">;
// The creators produce the body and header from the same type arguments as
// `TResponse`, which the compiler cannot relate to the assembled record.
export function createResponse(
  defaultResponse: object,
  creators: {
    body?: (input?: DataOverrides<unknown>) => unknown;
    header?: (input?: DataOverrides<unknown>) => unknown;
  },
  input: {
    statusCode?: number;
    body?: DataOverrides<unknown>;
    header?: DataOverrides<unknown>;
  } = {}
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {
    ...defaultResponse,
  };
  if (creators.body) defaults["body"] = creators.body();
  if (creators.header) defaults["header"] = creators.header();

  const overrides: Record<string, unknown> = {};
  if (input.statusCode !== undefined)
    overrides["statusCode"] = input.statusCode;
  if (input.body !== undefined && creators.body)
    overrides["body"] = creators.body(input.body);
  if (input.header !== undefined && creators.header)
    overrides["header"] = creators.header(input.header);

  return createData(defaults, overrides);
}
