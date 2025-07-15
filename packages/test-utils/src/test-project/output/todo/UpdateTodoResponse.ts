import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  ITodoNotFoundErrorResponse,
  TodoNotFoundErrorResponse,
} from "./TodoNotFoundErrorResponse";

import type {
  ITodoNotChangeableErrorResponse,
  TodoNotChangeableErrorResponse,
} from "./TodoNotChangeableErrorResponse";

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

export type IUpdateTodoSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IUpdateTodoSuccessResponseBody = {
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

export type IUpdateTodoSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IUpdateTodoSuccessResponseHeader;
  body: IUpdateTodoSuccessResponseBody;
};

export class UpdateTodoSuccessResponse
  extends HttpResponse<
    IUpdateTodoSuccessResponseHeader,
    IUpdateTodoSuccessResponseBody
  >
  implements IUpdateTodoSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IUpdateTodoSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for UpdateTodoSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IUpdateTodoSuccessResponses = IUpdateTodoSuccessResponse;

export type UpdateTodoSuccessResponses = UpdateTodoSuccessResponse;

export type IUpdateTodoResponse =
  | IUpdateTodoSuccessResponse
  | ITodoNotFoundErrorResponse
  | ITodoNotChangeableErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type UpdateTodoResponse =
  | UpdateTodoSuccessResponse
  | TodoNotFoundErrorResponse
  | TodoNotChangeableErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
