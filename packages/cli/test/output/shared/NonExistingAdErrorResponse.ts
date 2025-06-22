import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type INonExistingAdErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type INonExistingAdErrorResponseBody = {
  message: "Non existing ad";
  code: "NON_EXISTING_AD_ERROR";
  actualValues: {
    adId: string;
  };
};

export type INonExistingAdErrorResponse = {
  statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY;
  header: INonExistingAdErrorResponseHeader;
  body: INonExistingAdErrorResponseBody;
};

export class NonExistingAdErrorResponse
  extends HttpResponse<
    INonExistingAdErrorResponseHeader,
    INonExistingAdErrorResponseBody
  >
  implements INonExistingAdErrorResponse
{
  public override readonly statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY;

  public constructor(response: INonExistingAdErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.UNPROCESSABLE_ENTITY) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for NonExistingAdErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
