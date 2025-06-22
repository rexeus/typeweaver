import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IProjectNotFoundErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type IProjectNotFoundErrorResponseBody = {
  message: "Project not found";
  code: "PROJECT_NOT_FOUND_ERROR";
  actualValues: {
    projectId: string;
  };
};

export type IProjectNotFoundErrorResponse = {
  statusCode: HttpStatusCode.NOT_FOUND;
  header: IProjectNotFoundErrorResponseHeader;
  body: IProjectNotFoundErrorResponseBody;
};

export class ProjectNotFoundErrorResponse
  extends HttpResponse<
    IProjectNotFoundErrorResponseHeader,
    IProjectNotFoundErrorResponseBody
  >
  implements IProjectNotFoundErrorResponse
{
  public override readonly statusCode: HttpStatusCode.NOT_FOUND;

  public constructor(response: IProjectNotFoundErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.NOT_FOUND) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ProjectNotFoundErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
