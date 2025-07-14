import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type IConflictErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type IConflictErrorResponseBody = {
  message: "Conflicted request";
  code: "CONFLICT_ERROR";
};

export type IConflictErrorResponse = {
  statusCode: HttpStatusCode.CONFLICT;
  header: IConflictErrorResponseHeader;
  body: IConflictErrorResponseBody;
};

export class ConflictErrorResponse
  extends HttpResponse<IConflictErrorResponseHeader, IConflictErrorResponseBody>
  implements IConflictErrorResponse
{
  public override readonly statusCode: HttpStatusCode.CONFLICT;

  public constructor(response: IConflictErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.CONFLICT) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ConflictErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
