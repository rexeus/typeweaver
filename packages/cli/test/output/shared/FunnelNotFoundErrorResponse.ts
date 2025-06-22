import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IFunnelNotFoundErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type IFunnelNotFoundErrorResponseBody = {
  message: "Funnel not found";
  code: "FUNNEL_NOT_FOUND_ERROR";
  actualValues: {
    funnelId: string;
  };
};

export type IFunnelNotFoundErrorResponse = {
  statusCode: HttpStatusCode.NOT_FOUND;
  header: IFunnelNotFoundErrorResponseHeader;
  body: IFunnelNotFoundErrorResponseBody;
};

export class FunnelNotFoundErrorResponse
  extends HttpResponse<
    IFunnelNotFoundErrorResponseHeader,
    IFunnelNotFoundErrorResponseBody
  >
  implements IFunnelNotFoundErrorResponse
{
  public override readonly statusCode: HttpStatusCode.NOT_FOUND;

  public constructor(response: IFunnelNotFoundErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.NOT_FOUND) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for FunnelNotFoundErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
