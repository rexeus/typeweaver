import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  ITodoNotFoundErrorResponse,
  TodoNotFoundErrorResponse,
} from "./TodoNotFoundErrorResponse";

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

export type ICreateSubTodoSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type ICreateSubTodoSuccessResponseBody = {
  id: string;
  accountId: string;
  parentId?: string | undefined;
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

export type ICreateSubTodoSuccessResponse = {
  statusCode: HttpStatusCode.CREATED;
  header: ICreateSubTodoSuccessResponseHeader;
  body: ICreateSubTodoSuccessResponseBody;
};

export class CreateSubTodoSuccessResponse
  extends HttpResponse<
    ICreateSubTodoSuccessResponseHeader,
    ICreateSubTodoSuccessResponseBody
  >
  implements ICreateSubTodoSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.CREATED;

  public constructor(response: ICreateSubTodoSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.CREATED) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for CreateSubTodoSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type ICreateSubTodoSuccessResponses = ICreateSubTodoSuccessResponse;

export type CreateSubTodoSuccessResponses = CreateSubTodoSuccessResponse;

export type ICreateSubTodoResponse =
  | ICreateSubTodoSuccessResponse
  | ITodoNotFoundErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type CreateSubTodoResponse =
  | CreateSubTodoSuccessResponse
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
