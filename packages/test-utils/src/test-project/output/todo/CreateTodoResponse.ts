import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

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

export type ICreateTodoSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type ICreateTodoSuccessResponseBody = {
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

export type ICreateTodoSuccessResponse = {
  statusCode: HttpStatusCode.CREATED;
  header: ICreateTodoSuccessResponseHeader;
  body: ICreateTodoSuccessResponseBody;
};

export class CreateTodoSuccessResponse
  extends HttpResponse<
    ICreateTodoSuccessResponseHeader,
    ICreateTodoSuccessResponseBody
  >
  implements ICreateTodoSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.CREATED;

  public constructor(response: ICreateTodoSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.CREATED) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for CreateTodoSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type ICreateTodoSuccessResponses = ICreateTodoSuccessResponse;

export type CreateTodoSuccessResponses = CreateTodoSuccessResponse;

export type ICreateTodoResponse =
  | ICreateTodoSuccessResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type CreateTodoResponse =
  | CreateTodoSuccessResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
