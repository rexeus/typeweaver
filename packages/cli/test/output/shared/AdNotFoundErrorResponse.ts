import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IAdNotFoundErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type IAdNotFoundErrorResponseBody = {
  message: "Ad not found";
  code: "AD_NOT_FOUND_ERROR";
  actualValues: {
    adId: string;
  };
};

export type IAdNotFoundErrorResponse = {
  statusCode: HttpStatusCode.NOT_FOUND;
  header: IAdNotFoundErrorResponseHeader;
  body: IAdNotFoundErrorResponseBody;
};

export class AdNotFoundErrorResponse
  extends HttpResponse<
    IAdNotFoundErrorResponseHeader,
    IAdNotFoundErrorResponseBody
  >
  implements IAdNotFoundErrorResponse
{
  public override readonly statusCode: HttpStatusCode.NOT_FOUND;

  public constructor(response: IAdNotFoundErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.NOT_FOUND) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for AdNotFoundErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
