import type { ALBEvent, ALBResult } from "aws-lambda";
import type { HttpMethod, IHttpRequest, IHttpResponse } from "../definition";
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
 * Adapter for AWS Application Load Balancer (ALB) events.
 *
 * Handles the conversion between ALB event format and the framework-agnostic
 * HTTP types. ALB format is similar to API Gateway v1 with multi-value support.
 */
export class AwsAlbAdapter extends HttpAdapter<ALBEvent, ALBResult> {
  /**
   * Converts an ALB event to an IHttpRequest.
   *
   * @param event - The ALB event
   * @returns Promise resolving to an IHttpRequest
   */
  public async toRequest(event: ALBEvent): Promise<IHttpRequest> {
    const mergedHeaders = mergeMultiValueHeaders(
      event.headers,
      event.multiValueHeaders
    );
    const headers = mergedHeaders ? normalizeHeaders(mergedHeaders) : undefined;

    const query = mergeMultiValueQuery(
      event.queryStringParameters,
      event.multiValueQueryStringParameters
    );

    const body = parseBody(event.body, event.isBase64Encoded);

    return {
      method: event.httpMethod as HttpMethod,
      path: event.path,
      header: headers,
      query,
      // TODO: handle path parameters for alb
      param: undefined, // ALB doesn't provide path parameters
      body,
    };
  }

  /**
   * Converts an IHttpResponse to an ALB result.
   *
   * @param response - The IHttpResponse to convert
   * @returns An ALB result
   */
  public toResponse(response: IHttpResponse): ALBResult {
    const { statusCode, body, header } = response;

    const { headers, multiValueHeaders } = splitHeadersByMultiValue(header);

    return {
      statusCode,
      headers,
      multiValueHeaders,
      body: prepareResponseBody(body),
      isBase64Encoded: false,
    };
  }
}
