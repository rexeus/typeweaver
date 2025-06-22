import type {
  LambdaFunctionURLEvent,
  LambdaFunctionURLResult,
} from "aws-lambda";
import type { IHttpRequest, IHttpResponse } from "../definition";
import { AwsApiGatewayV2Adapter } from "./AwsApiGatewayV2Adapter";

/**
 * Adapter for AWS Lambda Function URL events.
 *
 * Lambda Function URLs use the same format as API Gateway HTTP API v2.0,
 * so this adapter extends AwsApiGatewayV2Adapter with proper typing.
 */
export class AwsLambdaFunctionUrlAdapter extends AwsApiGatewayV2Adapter {
  /**
   * Converts a Lambda Function URL event to an IHttpRequest.
   *
   * @param event - The Lambda Function URL event
   * @returns Promise resolving to an IHttpRequest
   */
  public override async toRequest(
    event: LambdaFunctionURLEvent
  ): Promise<IHttpRequest> {
    return super.toRequest(event);
  }

  /**
   * Converts an IHttpResponse to a Lambda Function URL result.
   *
   * @param response - The IHttpResponse to convert
   * @returns A Lambda Function URL result
   */
  public override toResponse(response: IHttpResponse): LambdaFunctionURLResult {
    return super.toResponse(response);
  }
}
