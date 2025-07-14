import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  ITodoNotFoundErrorResponse,
  TodoNotFoundErrorResponse,
} from "../shared/TodoNotFoundErrorResponse";

import type {
  ITodoStatusTransitionInvalidErrorResponse,
  TodoStatusTransitionInvalidErrorResponse,
} from "../shared/TodoStatusTransitionInvalidErrorResponse";

import type {
  ITodoNotChangeableErrorResponse,
  TodoNotChangeableErrorResponse,
} from "../shared/TodoNotChangeableErrorResponse";

import type {
  IForbiddenErrorResponse,
  ForbiddenErrorResponse,
} from "../shared/ForbiddenErrorResponse";

import type {
  IInternalServerErrorResponse,
  InternalServerErrorResponse,
} from "../shared/InternalServerErrorResponse";

import type {
  ITooManyRequestsErrorResponse,
  TooManyRequestsErrorResponse,
} from "../shared/TooManyRequestsErrorResponse";

import type {
  IUnauthorizedErrorResponse,
  UnauthorizedErrorResponse,
} from "../shared/UnauthorizedErrorResponse";

import type {
  IUnsupportedMediaTypeErrorResponse,
  UnsupportedMediaTypeErrorResponse,
} from "../shared/UnsupportedMediaTypeErrorResponse";

import type {
  IValidationErrorResponse,
  ValidationErrorResponse,
} from "../shared/ValidationErrorResponse";

export type IUpdateTodoStatusSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IUpdateTodoStatusSuccessResponseBody = {
  id: string;
  accountId: string;
  title: string;
  description?: string | undefined;
  status: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";
  dueDate?: string | undefined;
  tags?: string[] | undefined;
  priority?: ("LOW" | "MEDIUM" | "HIGH") | undefined;
  createdAt: string;
  modifiedAt: string;
  createdBy: string;
  modifiedBy: string;
};

export type IUpdateTodoStatusSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IUpdateTodoStatusSuccessResponseHeader;
  body: IUpdateTodoStatusSuccessResponseBody;
};

export class UpdateTodoStatusSuccessResponse
  extends HttpResponse<
    IUpdateTodoStatusSuccessResponseHeader,
    IUpdateTodoStatusSuccessResponseBody
  >
  implements IUpdateTodoStatusSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IUpdateTodoStatusSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for UpdateTodoStatusSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IUpdateTodoStatusSuccessResponses =
  IUpdateTodoStatusSuccessResponse;

export type UpdateTodoStatusSuccessResponses = UpdateTodoStatusSuccessResponse;

export type IUpdateTodoStatusResponse =
  | IUpdateTodoStatusSuccessResponse
  | ITodoNotFoundErrorResponse
  | ITodoStatusTransitionInvalidErrorResponse
  | ITodoNotChangeableErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type UpdateTodoStatusResponse =
  | UpdateTodoStatusSuccessResponse
  | TodoNotFoundErrorResponse
  | TodoStatusTransitionInvalidErrorResponse
  | TodoNotChangeableErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
