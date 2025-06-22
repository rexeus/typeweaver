import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import type {
  HttpMethod,
  IHttpRequest,
  IHttpResponse,
  IHttpParam,
  IHttpQuery,
} from "../definition";
import { HttpAdapter } from "./HttpAdapter";
import { parseBody, normalizeHeaders, prepareResponseBody } from "./utils";

/**
 * Adapter for AWS API Gateway HTTP API v2.0 format.
 *
 * Handles the conversion between API Gateway v2 proxy integration format
 * and the framework-agnostic HTTP types. This format has simplified header
 * and query parameter handling compared to v1.
 */
export class AwsApiGatewayV2Adapter extends HttpAdapter<
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2
> {
  /**
   * Converts an API Gateway v2 proxy event to an IHttpRequest.
   *
   * @param event - The API Gateway v2 proxy event
   * @returns Promise resolving to an IHttpRequest
   */
  public async toRequest(event: APIGatewayProxyEventV2): Promise<IHttpRequest> {
    const headers = normalizeHeaders(event.headers);
    const query = this.extractQueryParams(event.queryStringParameters);
    const body = parseBody(event.body ?? null, event.isBase64Encoded);

    return {
      method: event.requestContext.http.method as HttpMethod,
      path: event.rawPath,
      header: headers,
      query,
      param: this.extractPathParams(event.pathParameters),
      body,
    };
  }

  /**
   * Converts an IHttpResponse to an API Gateway v2 proxy result.
   *
   * @param response - The IHttpResponse to convert
   * @returns An API Gateway v2 proxy result
   */
  public toResponse(response: IHttpResponse): APIGatewayProxyResultV2 {
    const { statusCode, body, header } = response;

    const result: APIGatewayProxyStructuredResultV2 = {
      statusCode,
      headers: this.flattenHeaders(header),
      body: prepareResponseBody(body),
      isBase64Encoded: false,
    };

    return result;
  }

  private extractQueryParams(params?: {
    [name: string]: string | undefined;
  }): IHttpQuery {
    if (!params) return undefined;

    const result: Record<string, string | string[]> = {};

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (value.includes(",")) {
          result[key] = value.split(",").map(v => v.trim());
        } else {
          result[key] = value;
        }
      }
    });

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private flattenHeaders(
    header?: import("../definition").IHttpHeader
  ): { [header: string]: boolean | number | string } | undefined {
    if (!header) return undefined;

    const result: { [header: string]: boolean | number | string } = {};

    Object.entries(header).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        result[key] = value.join(", ");
      } else if (value !== undefined) {
        result[key] = value;
      }
    });

    return Object.keys(result).length > 0 ? result : undefined;
  }

  private extractPathParams(pathParams?: {
    [name: string]: string | undefined;
  }): IHttpParam {
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
