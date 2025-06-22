import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IProjectStatusTransitionErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type IProjectStatusTransitionErrorResponseBody = {
  message: "Project status transition is conflicted with the current status";
  code: "PROJECT_STATUS_TRANSITION_ERROR";
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
    allowedStatuses: (
      | "INITIAL"
      | "DRAFT"
      | "REQUEST_GENERATION"
      | "IN_GENERATION"
      | "IN_REVIEW"
      | "PUBLISHED"
      | "WITHDRAWN"
    )[];
  };
};

export type IProjectStatusTransitionErrorResponse = {
  statusCode: HttpStatusCode.CONFLICT;
  header: IProjectStatusTransitionErrorResponseHeader;
  body: IProjectStatusTransitionErrorResponseBody;
};

export class ProjectStatusTransitionErrorResponse
  extends HttpResponse<
    IProjectStatusTransitionErrorResponseHeader,
    IProjectStatusTransitionErrorResponseBody
  >
  implements IProjectStatusTransitionErrorResponse
{
  public override readonly statusCode: HttpStatusCode.CONFLICT;

  public constructor(response: IProjectStatusTransitionErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.CONFLICT) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ProjectStatusTransitionErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
