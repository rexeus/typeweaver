import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type INotUpdateableProjectStatusErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type INotUpdateableProjectStatusErrorResponseBody = {
  message: "Updating project is conflicted with current status";
  code: "NOT_UPDATEABLE_PROJECT_STATUS_ERROR";
  actualValues: {
    currentStatus:
      | "INITIAL"
      | "DRAFT"
      | "REQUEST_GENERATION"
      | "IN_GENERATION"
      | "IN_REVIEW"
      | "PUBLISHED"
      | "WITHDRAWN";
  };
  expectedValues: {
    requiredStatuses: ["INITIAL", "DRAFT", "IN_REVIEW", "WITHDRAWN"];
  };
};

export type INotUpdateableProjectStatusErrorResponse = {
  statusCode: HttpStatusCode.CONFLICT;
  header: INotUpdateableProjectStatusErrorResponseHeader;
  body: INotUpdateableProjectStatusErrorResponseBody;
};

export class NotUpdateableProjectStatusErrorResponse
  extends HttpResponse<
    INotUpdateableProjectStatusErrorResponseHeader,
    INotUpdateableProjectStatusErrorResponseBody
  >
  implements INotUpdateableProjectStatusErrorResponse
{
  public override readonly statusCode: HttpStatusCode.CONFLICT;

  public constructor(response: INotUpdateableProjectStatusErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.CONFLICT) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for NotUpdateableProjectStatusErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
