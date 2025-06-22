import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IProjectRequestGenerationErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type IProjectRequestGenerationErrorResponseBody = {
  message: "Requesting project generation is conflicted with the current state";
  code: "PROJECT_REQUEST_GENERATION_ERROR";
  actualValues: {
    currentStatus:
      | "INITIAL"
      | "DRAFT"
      | "REQUEST_GENERATION"
      | "IN_GENERATION"
      | "IN_REVIEW"
      | "PUBLISHED"
      | "WITHDRAWN";
    completionErrors?: any[] | undefined;
  };
  expectedValues: {
    requiredStatuses: ["DRAFT", "WITHDRAWN"];
  };
};

export type IProjectRequestGenerationErrorResponse = {
  statusCode: HttpStatusCode.CONFLICT;
  header: IProjectRequestGenerationErrorResponseHeader;
  body: IProjectRequestGenerationErrorResponseBody;
};

export class ProjectRequestGenerationErrorResponse
  extends HttpResponse<
    IProjectRequestGenerationErrorResponseHeader,
    IProjectRequestGenerationErrorResponseBody
  >
  implements IProjectRequestGenerationErrorResponse
{
  public override readonly statusCode: HttpStatusCode.CONFLICT;

  public constructor(response: IProjectRequestGenerationErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.CONFLICT) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ProjectRequestGenerationErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
