import {
  type HttpMethod,
  type IHttpRequest,
  type IHttpHeader,
  type IHttpParam,
  type IHttpQuery,
  type IHttpBody,
  type IHttpResponse,
  HttpResponse,
} from "../definition";

/**
 * Abstract base class for type-safe API request commands.
 *
 * This class represents a command pattern for HTTP requests, providing:
 * - Type-safe request parameters (headers, path params, query, body)
 * - Response processing abstraction
 * - Integration with ApiClient for execution
 *
 * Implementations should:
 * 1. Set all readonly properties in the constructor
 * 2. Implement processResponse to handle response transformation
 *
 * @template Header - The HTTP header type
 * @template Param - The path parameter type
 * @template Query - The query string parameter type
 * @template Body - The request body type
 */
export abstract class RequestCommand<
  Header extends IHttpHeader = IHttpHeader | undefined,
  Param extends IHttpParam = IHttpParam | undefined,
  Query extends IHttpQuery = IHttpQuery | undefined,
  Body extends IHttpBody = IHttpBody | undefined,
> implements IHttpRequest
{
  /** The HTTP method for this request */
  public readonly method!: HttpMethod;
  /** The URL path pattern with parameter placeholders (e.g., '/users/:id') */
  public readonly path!: string;
  /** HTTP headers to send with the request */
  public readonly header!: Header;
  /** Path parameters to substitute in the URL */
  public readonly param!: Param;
  /** Query string parameters */
  public readonly query!: Query;
  /** Request body data */
  public readonly body!: Body;

  /**
   * Processes the raw HTTP response into a typed response object.
   *
   * This method should handle:
   * - Response validation
   * - Data transformation
   * - Error response handling
   *
   * @param response - The raw HTTP response from the server
   * @returns The processed, type-safe response object
   */
  public abstract processResponse(response: IHttpResponse): HttpResponse;
}
