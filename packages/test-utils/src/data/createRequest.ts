import type { IValidatedHttpRequest } from "@rexeus/typeweaver-core";
import { createData } from "./createData.js";

type RequestCreators<TBody, THeader, TParam, TQuery> = {
  body?: (input?: Partial<TBody>) => TBody;
  header?: (input?: Partial<THeader>) => THeader;
  param?: (input?: Partial<TParam>) => TParam;
  query?: (input?: Partial<TQuery>) => TQuery;
};

type RequestInput<TBody, THeader, TParam, TQuery> = {
  path?: string;
  body?: Partial<TBody>;
  header?: Partial<THeader>;
  param?: Partial<TParam>;
  query?: Partial<TQuery>;
};

const applyRequestDefaults = <TBody, THeader, TParam, TQuery>(
  target: Record<string, unknown>,
  creators: RequestCreators<TBody, THeader, TParam, TQuery>
): void => {
  if (creators.body) target.body = creators.body();
  if (creators.header) target.header = creators.header();
  if (creators.param) target.param = creators.param();
  if (creators.query) target.query = creators.query();
};

const applyRequestOverrides = <TBody, THeader, TParam, TQuery>(
  target: Record<string, unknown>,
  creators: RequestCreators<TBody, THeader, TParam, TQuery>,
  input: RequestInput<TBody, THeader, TParam, TQuery>
): void => {
  if (input.path !== undefined) target.path = input.path;
  if (input.body && creators.body) target.body = creators.body(input.body);
  if (input.header && creators.header)
    target.header = creators.header(input.header);
  if (input.param && creators.param) target.param = creators.param(input.param);
  if (input.query && creators.query) target.query = creators.query(input.query);
};

/**
 * Creates a fully populated test request by composing individual part creators.
 *
 * Builds a request object from separate body, header, param, and query creators,
 * each producing defaults that can be individually overridden. This allows tests
 * to create valid requests with minimal boilerplate while only specifying the
 * fields relevant to the test case.
 *
 * @template TRequest - The specific request type (e.g., `ICreateTodoRequest`)
 * @template TBody - Request body type
 * @template THeader - Request header type
 * @template TParam - Path parameter type
 * @template TQuery - Query parameter type
 * @param defaultRequest - Base request properties (method, path)
 * @param creators - Factory functions for each request part (body, header, param, query)
 * @param input - Optional partial overrides for any request part
 * @returns A fully populated request object of type `TRequest`
 */
export function createRequest<
  TRequest extends IValidatedHttpRequest,
  TBody,
  THeader,
  TParam,
  TQuery,
>(
  defaultRequest: Omit<TRequest, "body" | "header" | "param" | "query">,
  creators: RequestCreators<TBody, THeader, TParam, TQuery>,
  input: RequestInput<TBody, THeader, TParam, TQuery> = {}
): TRequest {
  const defaults: Record<string, unknown> = {
    ...defaultRequest,
  };
  applyRequestDefaults(defaults, creators);

  const overrides: Record<string, unknown> = {};
  applyRequestOverrides(overrides, creators, input);

  return createData(defaults as TRequest, overrides as Partial<TRequest>);
}
