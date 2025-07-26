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

export type IPutTodoSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IPutTodoSuccessResponseBody = {
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

export type IPutTodoSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IPutTodoSuccessResponseHeader;
  body: IPutTodoSuccessResponseBody;
};

export class PutTodoSuccessResponse
  extends HttpResponse<
    IPutTodoSuccessResponseHeader,
    IPutTodoSuccessResponseBody
  >
  implements IPutTodoSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IPutTodoSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for PutTodoSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IPutTodoSuccessResponses = IPutTodoSuccessResponse;

export type PutTodoSuccessResponses = PutTodoSuccessResponse;

export type IPutTodoResponse =
  | IPutTodoSuccessResponse
  | ITodoNotFoundErrorResponse
  | ITodoNotChangeableErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type PutTodoResponse =
  | PutTodoSuccessResponse
  | TodoNotFoundErrorResponse
  | TodoNotChangeableErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
