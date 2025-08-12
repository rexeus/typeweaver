import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IInternalServerErrorResponseHeader = {
  "Content-Type": "application/json";
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type IInternalServerErrorResponseBody = {
  message: "Internal server error occurred";
  code: "INTERNAL_SERVER_ERROR";
};

export type IInternalServerErrorResponse = {
  statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR;
  header: IInternalServerErrorResponseHeader;
  body: IInternalServerErrorResponseBody;
};

export class InternalServerErrorResponse
  extends HttpResponse<
    IInternalServerErrorResponseHeader,
    IInternalServerErrorResponseBody
  >
  implements IInternalServerErrorResponse
{
  public override readonly statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR;

  public constructor(response: IInternalServerErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.INTERNAL_SERVER_ERROR) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for InternalServerErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
