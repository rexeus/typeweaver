import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

export type ISubTodoStatusTransitionInvalidErrorResponseHeader = {
  "Content-Type": "application/json";
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type ISubTodoStatusTransitionInvalidErrorResponseBody = {
  message: "SubTodo status transition is conflicting with its status or parent todo status";
  code: "SUBTODO_STATUS_TRANSITION_INVALID_ERROR";
  context: {
    todoId: string;
    subtodoId: string;
    currentTodoStatus: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
    currentSubtodoStatus: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  };
  actualValues: {
    requestedSubtodoStatus: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  };
  expectedValues: {
    allowedSubtodoStatuses: ("TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED")[];
  };
};

export type ISubTodoStatusTransitionInvalidErrorResponse = {
  statusCode: HttpStatusCode.CONFLICT;
  header: ISubTodoStatusTransitionInvalidErrorResponseHeader;
  body: ISubTodoStatusTransitionInvalidErrorResponseBody;
};

export class SubTodoStatusTransitionInvalidErrorResponse
  extends HttpResponse<
    ISubTodoStatusTransitionInvalidErrorResponseHeader,
    ISubTodoStatusTransitionInvalidErrorResponseBody
  >
  implements ISubTodoStatusTransitionInvalidErrorResponse
{
  public override readonly statusCode: HttpStatusCode.CONFLICT;

  public constructor(response: ISubTodoStatusTransitionInvalidErrorResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.CONFLICT) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for SubTodoStatusTransitionInvalidErrorResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}
