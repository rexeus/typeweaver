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

export type IGetTodoSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IGetTodoSuccessResponseBody = {
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

export type IGetTodoSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IGetTodoSuccessResponseHeader;
  body: IGetTodoSuccessResponseBody;
};

export class GetTodoSuccessResponse
  extends HttpResponse<
    IGetTodoSuccessResponseHeader,
    IGetTodoSuccessResponseBody
  >
  implements IGetTodoSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IGetTodoSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for GetTodoSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IGetTodoSuccessResponses = IGetTodoSuccessResponse;

export type GetTodoSuccessResponses = GetTodoSuccessResponse;

export type IGetTodoResponse =
  | IGetTodoSuccessResponse
  | ITodoNotFoundErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type GetTodoResponse =
  | GetTodoSuccessResponse
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
