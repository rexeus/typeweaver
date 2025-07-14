import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type ITodoStatusTransitionInvalidErrorResponseHeader = {
  "Content-Type": "application/json";
};

export type ITodoStatusTransitionInvalidErrorResponseBody = {
  message: "Todo status transition is conflicting with current status";
  code: "TODO_STATUS_TRANSITION_INVALID_ERROR";
  context: {
    todoId: string;
    currentStatus: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  };
  actualValues: {
    requestedStatus: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  };
  expectedValues: {
    allowedStatuses: ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED")[];
  };
};

export type ITodoStatusTransitionInvalidErrorResponse = {
  statusCode: HttpStatusCode.CONFLICT;
  header: ITodoStatusTransitionInvalidErrorResponseHeader;
  body: ITodoStatusTransitionInvalidErrorResponseBody;
};

export class TodoStatusTransitionInvalidErrorResponse
  extends HttpResponse<
    ITodoStatusTransitionInvalidErrorResponseHeader,
    ITodoStatusTransitionInvalidErrorResponseBody
  >
  implements ITodoStatusTransitionInvalidErrorResponse
{
  public override readonly statusCode: HttpStatusCode.CONFLICT;

  public constructor(response: ITodoStatusTransitionInvalidErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.CONFLICT) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for TodoStatusTransitionInvalidErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
