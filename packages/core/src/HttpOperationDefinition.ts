import { HttpMethod } from "./HttpMethod";
import type { HttpBodySchema } from "./HttpBody";
import type { HttpHeaderSchema } from "./HttpHeader";
import type { HttpParamSchema } from "./HttpParam";
import type { HttpQuerySchema } from "./HttpQuery";
import type { IHttpRequestDefinition } from "./HttpRequestDefinition";
import type { IHttpResponseDefinition } from "./HttpResponseDefinition";

/**
 * Interface for HTTP operation definitions.
 *
 * Represents a complete HTTP API operation with:
 * - Unique operation identifier
 * - HTTP method and path
 * - Request definition (headers, params, query, body)
 * - Response definitions for different status codes
 *
 * @template TOperationId - The operation identifier literal type
 * @template TPath - The URL path literal type
 * @template TMethod - The HTTP method type
 * @template TSummary - The operation summary literal type
 * @template THeader - The header schema type
 * @template TParam - The path parameter schema type
 * @template TQuery - The query parameter schema type
 * @template TBody - The request body schema type
 * @template TRequest - The complete request definition type
 * @template TResponses - The array of response definitions
 */
export type IHttpOperationDefinition<
  TOperationId extends string = string,
  TPath extends string = string,
  TMethod extends HttpMethod = HttpMethod,
  TSummary extends string = string,
  THeader extends HttpHeaderSchema | undefined = HttpHeaderSchema | undefined,
  TParam extends HttpParamSchema | undefined = HttpParamSchema | undefined,
  TQuery extends HttpQuerySchema | undefined = HttpQuerySchema | undefined,
  TBody extends HttpBodySchema | undefined = HttpBodySchema | undefined,
  TRequest extends IHttpRequestDefinition<THeader, TParam, TQuery, TBody> =
    IHttpRequestDefinition<THeader, TParam, TQuery, TBody>,
  TResponses extends IHttpResponseDefinition[] = IHttpResponseDefinition[],
> = {
  operationId: TOperationId;
  path: TPath;
  method: TMethod;
  summary: TSummary;
  request: TRequest;
  responses: TResponses;
};

/**
 * Concrete implementation of HTTP operation definition.
 *
 * This class provides a type-safe way to define HTTP API operations with:
 * - Full TypeScript type inference for all components
 * - Integration with Zod schemas for runtime validation
 * - Support for multiple response definitions per operation
 * - OpenAPI-compatible structure
 *
 * The extensive generic parameters enable complete type safety from
 * definition through to runtime execution and code generation.
 *
 * @template TOperationId - The operation identifier literal type
 * @template TPath - The URL path literal type
 * @template TMethod - The HTTP method type
 * @template TSummary - The operation summary literal type
 * @template THeader - The header schema type
 * @template TParam - The path parameter schema type
 * @template TQuery - The query parameter schema type
 * @template TBody - The request body schema type
 * @template TRequest - The complete request definition type
 * @template TResponses - The array of response definitions
 */
export class HttpOperationDefinition<
  TOperationId extends string,
  TPath extends string,
  TMethod extends HttpMethod,
  TSummary extends string,
  THeader extends HttpHeaderSchema | undefined,
  TParam extends HttpParamSchema | undefined,
  TQuery extends HttpQuerySchema | undefined,
  TBody extends HttpBodySchema | undefined,
  TRequest extends IHttpRequestDefinition<THeader, TParam, TQuery, TBody>,
  TResponses extends IHttpResponseDefinition[],
> implements IHttpOperationDefinition<
  TOperationId,
  TPath,
  TMethod,
  TSummary,
  THeader,
  TParam,
  TQuery,
  TBody,
  TRequest,
  TResponses
> {
  public readonly operationId: TOperationId;
  public readonly path: TPath;
  public readonly method: TMethod;
  public readonly summary: TSummary;
  public readonly request: TRequest;
  public readonly responses: TResponses;

  public constructor(
    definition: IHttpOperationDefinition<
      TOperationId,
      TPath,
      TMethod,
      TSummary,
      THeader,
      TParam,
      TQuery,
      TBody,
      TRequest,
      TResponses
    >
  ) {
    this.operationId = definition.operationId;
    this.path = definition.path;
    this.method = definition.method;
    this.summary = definition.summary;
    this.request = definition.request;
    this.responses = definition.responses;
  }
}
