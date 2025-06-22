import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type {
  HttpMethod,
  IHttpRequest,
  IHttpResponse,
  IHttpParam,
} from "../definition";
import { HttpAdapter } from "./HttpAdapter";
import {
  parseBody,
  normalizeHeaders,
  mergeMultiValueHeaders,
  mergeMultiValueQuery,
  splitHeadersByMultiValue,
  prepareResponseBody,
} from "./utils";

/**
 * Adapter for AWS API Gateway REST API and HTTP API v1.0 format.
 *
 * Handles the conversion between API Gateway v1 proxy integration format
 * and the framework-agnostic HTTP types. This format includes support for
 * multi-value headers and query parameters.
 */
export class AwsApiGatewayV1Adapter extends HttpAdapter<
  APIGatewayProxyEvent,
  APIGatewayProxyResult
> {
  /**
   * Converts an API Gateway v1 proxy event to an IHttpRequest.
   *
   * @param event - The API Gateway proxy event
   * @returns Promise resolving to an IHttpRequest
   */
  public async toRequest(event: APIGatewayProxyEvent): Promise<IHttpRequest> {
    const mergedHeaders = mergeMultiValueHeaders(
      event.headers,
      event.multiValueHeaders
    );
    const headers = mergedHeaders ? normalizeHeaders(mergedHeaders) : undefined;

    const query = mergeMultiValueQuery(
      event.queryStringParameters,
      event.multiValueQueryStringParameters,
      false // API Gateway v1 doesn't decode query params
    );

    const body = parseBody(event.body, event.isBase64Encoded);

    return {
      method: event.httpMethod as HttpMethod,
      path: event.path,
      header: headers,
      query,
      param: this.extractPathParams(event.pathParameters),
      body,
    };
  }

  /**
   * Converts an IHttpResponse to an API Gateway v1 proxy result.
   *
   * @param response - The IHttpResponse to convert
   * @returns An API Gateway proxy result
   */
  public toResponse(response: IHttpResponse): APIGatewayProxyResult {
    const { statusCode, body, header } = response;

    const { headers, multiValueHeaders } = splitHeadersByMultiValue(header);

    return {
      statusCode,
      headers,
      multiValueHeaders,
      body: prepareResponseBody(body) ?? "",
      isBase64Encoded: false,
    };
  }

  private extractPathParams(
    pathParams: { [name: string]: string | undefined } | null
  ): IHttpParam {
    if (!pathParams) return undefined;

    const result: Record<string, string> = {};
    Object.entries(pathParams).forEach(([key, value]) => {
      if (value !== undefined) {
        result[key] = value;
      }
    });

    return Object.keys(result).length > 0 ? result : undefined;
  }
}
