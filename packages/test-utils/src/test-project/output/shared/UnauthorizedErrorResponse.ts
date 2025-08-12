import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IUnauthorizedErrorResponseHeader = {
  "Content-Type": "application/json";
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type IUnauthorizedErrorResponseBody = {
  message: "Unauthorized request";
  code: "UNAUTHORIZED_ERROR";
};

export type IUnauthorizedErrorResponse = {
  statusCode: HttpStatusCode.UNAUTHORIZED;
  header: IUnauthorizedErrorResponseHeader;
  body: IUnauthorizedErrorResponseBody;
};

export class UnauthorizedErrorResponse
  extends HttpResponse<
    IUnauthorizedErrorResponseHeader,
    IUnauthorizedErrorResponseBody
  >
  implements IUnauthorizedErrorResponse
{
  public override readonly statusCode: HttpStatusCode.UNAUTHORIZED;

  public constructor(response: IUnauthorizedErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.UNAUTHORIZED) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for UnauthorizedErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
