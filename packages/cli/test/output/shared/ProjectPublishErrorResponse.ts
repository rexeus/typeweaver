import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IProjectPublishErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type IProjectPublishErrorResponseBody = {
  message: "Publishing project is conflicted with the current state";
  code: "PROJECT_PUBLISH_ERROR";
  actualValues: {
    currentStatus:
      | "INITIAL"
      | "DRAFT"
      | "REQUEST_GENERATION"
      | "IN_GENERATION"
      | "IN_REVIEW"
      | "PUBLISHED"
      | "WITHDRAWN";
    isAdForPublishingSelected: boolean;
    isFunnelForPublishingSelected: boolean;
  };
  expectedValues: {
    requiredStatuses: ["IN_REVIEW", "WITHDRAWN"];
    isAdForPublishingSelected: true;
    isFunnelForPublishingSelected: true;
  };
};

export type IProjectPublishErrorResponse = {
  statusCode: HttpStatusCode.CONFLICT;
  header: IProjectPublishErrorResponseHeader;
  body: IProjectPublishErrorResponseBody;
};

export class ProjectPublishErrorResponse
  extends HttpResponse<
    IProjectPublishErrorResponseHeader,
    IProjectPublishErrorResponseBody
  >
  implements IProjectPublishErrorResponse
{
  public override readonly statusCode: HttpStatusCode.CONFLICT;

  public constructor(response: IProjectPublishErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.CONFLICT) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ProjectPublishErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
