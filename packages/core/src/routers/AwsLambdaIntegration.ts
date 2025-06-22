import type {
  Context as LambdaContext,
  ALBHandler,
  APIGatewayProxyHandler,
  APIGatewayProxyHandlerV2,
  LambdaFunctionURLHandler,
} from "aws-lambda";
import {
  type HttpMethod,
  type IHttpRequest,
  type IHttpResponse,
} from "../definition";
import {
  HttpRouter,
  type HttpHandler,
  type HttpRoute,
  type AnyHttpRoute,
} from "./HttpRouter";
import type { RequestValidator } from "../validation";
import { AwsAlbAdapter } from "../adapters/AwsAlbAdapter";
import { AwsApiGatewayV1Adapter } from "../adapters/AwsApiGatewayV1Adapter";
import { AwsApiGatewayV2Adapter } from "../adapters/AwsApiGatewayV2Adapter";
import { AwsLambdaFunctionUrlAdapter } from "../adapters/AwsLambdaFunctionUrlAdapter";
import { createHttpHandler, type HttpHandlerOptions } from "./utils";

export type { Context as LambdaContext } from "aws-lambda";

export type AwsLambdaHandler<
  Request extends IHttpRequest = IHttpRequest,
  Response extends IHttpResponse = IHttpResponse,
> = HttpHandler<Request, Response, LambdaContext>;

export type AwsLambdaRoute<
  Method extends HttpMethod = HttpMethod,
  Path extends string = string,
  Request extends IHttpRequest = IHttpRequest,
  Response extends IHttpResponse = IHttpResponse,
  Validator extends RequestValidator = RequestValidator,
> = HttpRoute<Method, Path, Request, Response, LambdaContext, Validator>;

/**
 * AWS Lambda-specific HTTP router that extends HttpRouter with LambdaContext typing.
 *
 * This router ensures that all routes use LambdaContext as their context type,
 * providing better type safety for AWS Lambda applications.
 *
 * @template Routes - The readonly array type of Lambda-specific route definitions
 */
export abstract class AwsLambdaHttpRouter<
  Routes extends
    readonly AnyHttpRoute<LambdaContext>[] = readonly AnyHttpRoute<LambdaContext>[],
> extends HttpRouter<Routes> {
  /**
   * Routes an HTTP request to the appropriate handler without validation.
   *
   * @template Request - The HTTP request type
   * @param request - The HTTP request to route
   * @param context - The Lambda context
   * @returns Promise resolving to the HTTP response
   * @throws {HttpRouteNotFoundError} When no matching route is found
   */
  public override async route<Request extends IHttpRequest = IHttpRequest>(
    request: Request,
    context: LambdaContext
  ): Promise<IHttpResponse> {
    return super.route(request, context);
  }

  /**
   * Routes an HTTP request to the appropriate handler with request validation.
   *
   * @template Request - The HTTP request type
   * @param request - The HTTP request to route
   * @param context - The Lambda context
   * @returns Promise resolving to the HTTP response
   * @throws {HttpRouteNotFoundError} When no matching route is found
   * @throws {RequestValidationError} When request validation fails
   */
  public override async routeWithValidation<
    Request extends IHttpRequest = IHttpRequest,
  >(request: Request, context: LambdaContext): Promise<IHttpResponse> {
    return super.routeWithValidation(request, context);
  }
}

/**
 * AWS Lambda-specific handler options.
 */
export type AwsLambdaHandlerOptions = HttpHandlerOptions<LambdaContext>;

/**
 * Creates an ALB-compatible handler function from an AwsLambdaHttpRouter.
 *
 * @param router - The AwsLambdaHttpRouter instance to wrap
 * @param options - Optional configuration
 * @returns A function that can be used as an ALB handler
 *
 * @example
 * ```typescript
 * export const handler = createAwsAlbHandler(router, {
 *   handleErrors: "auto",
 *   onError: (error) => {
 *     if (error instanceof MyCustomError) {
 *       return {
 *         statusCode: 422,
 *         body: { error: error.code, message: error.message },
 *         header: { "content-type": "application/json" }
 *       };
 *     }
 *   }
 * });
 * ```
 */
export function createAwsAlbHandler(
  router: AwsLambdaHttpRouter<any>,
  options?: AwsLambdaHandlerOptions
): ALBHandler {
  const adapter = new AwsAlbAdapter();
  return createHttpHandler(
    router,
    adapter,
    options,
    (_event, context) => context // Lambda context is passed as-is to the router
  );
}

/**
 * Creates an API Gateway v1-compatible handler function from an AwsLambdaHttpRouter.
 *
 * @param router - The AwsLambdaHttpRouter instance to wrap
 * @param options - Optional configuration
 * @returns A function that can be used as an API Gateway v1 handler
 *
 * @example
 * ```typescript
 * export const handler = createAwsApiGatewayV1Handler(router, {
 *   handleErrors: "auto",
 *   validate: true
 * });
 * ```
 */
export function createAwsApiGatewayV1Handler(
  router: AwsLambdaHttpRouter<any>,
  options?: AwsLambdaHandlerOptions
): APIGatewayProxyHandler {
  const adapter = new AwsApiGatewayV1Adapter();
  return createHttpHandler(
    router,
    adapter,
    options,
    (_event, context) => context // Lambda context is passed as-is to the router
  );
}

/**
 * Creates an API Gateway v2-compatible handler function from an AwsLambdaHttpRouter.
 *
 * @param router - The AwsLambdaHttpRouter instance to wrap
 * @param options - Optional configuration
 * @returns A function that can be used as an API Gateway v2 handler
 *
 * @example
 * ```typescript
 * export const handler = createAwsApiGatewayV2Handler(router, {
 *   handleErrors: "auto",
 *   validate: true
 * });
 * ```
 */
export function createAwsApiGatewayV2Handler(
  router: AwsLambdaHttpRouter<any>,
  options?: AwsLambdaHandlerOptions
): APIGatewayProxyHandlerV2 {
  const adapter = new AwsApiGatewayV2Adapter();
  return createHttpHandler(
    router,
    adapter,
    options,
    (_event, context) => context // Lambda context is passed as-is to the router
  );
}

/**
 * Creates a Lambda Function URL-compatible handler function from an AwsLambdaHttpRouter.
 *
 * @param router - The AwsLambdaHttpRouter instance to wrap
 * @param options - Optional configuration
 * @returns A function that can be used as a Lambda Function URL handler
 *
 * @example
 * ```typescript
 * export const handler = createAwsLambdaFunctionUrlHandler(router, {
 *   handleErrors: "auto",
 *   validate: true
 * });
 * ```
 */
export function createAwsLambdaFunctionUrlHandler(
  router: AwsLambdaHttpRouter<any>,
  options?: AwsLambdaHandlerOptions
): LambdaFunctionURLHandler {
  const adapter = new AwsLambdaFunctionUrlAdapter();
  return createHttpHandler(
    router,
    adapter,
    options,
    (_event, context) => context // Lambda context is passed as-is to the router
  );
}
