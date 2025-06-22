import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type INonExistingFunnelErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type INonExistingFunnelErrorResponseBody = {
  message: "Non existing funnel";
  code: "NON_EXISTING_FUNNEL_ERROR";
  actualValues: {
    funnelId: string;
  };
};

export type INonExistingFunnelErrorResponse = {
  statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY;
  header: INonExistingFunnelErrorResponseHeader;
  body: INonExistingFunnelErrorResponseBody;
};

export class NonExistingFunnelErrorResponse
  extends HttpResponse<
    INonExistingFunnelErrorResponseHeader,
    INonExistingFunnelErrorResponseBody
  >
  implements INonExistingFunnelErrorResponse
{
  public override readonly statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY;

  public constructor(response: INonExistingFunnelErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.UNPROCESSABLE_ENTITY) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for NonExistingFunnelErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
