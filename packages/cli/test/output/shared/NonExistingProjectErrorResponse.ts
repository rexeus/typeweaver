import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type INonExistingProjectErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type INonExistingProjectErrorResponseBody = {
  message: "Non existing project";
  code: "NON_EXISTING_PROJECT_ERROR";
  actualValues: {
    projectId: string;
  };
};

export type INonExistingProjectErrorResponse = {
  statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY;
  header: INonExistingProjectErrorResponseHeader;
  body: INonExistingProjectErrorResponseBody;
};

export class NonExistingProjectErrorResponse
  extends HttpResponse<
    INonExistingProjectErrorResponseHeader,
    INonExistingProjectErrorResponseBody
  >
  implements INonExistingProjectErrorResponse
{
  public override readonly statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY;

  public constructor(response: INonExistingProjectErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.UNPROCESSABLE_ENTITY) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for NonExistingProjectErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
