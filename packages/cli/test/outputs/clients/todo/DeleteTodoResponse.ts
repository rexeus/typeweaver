import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  ITodoNotFoundErrorResponse,
  TodoNotFoundErrorResponse,
} from "../shared/TodoNotFoundErrorResponse";

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

export type IDeleteTodoSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IDeleteTodoSuccessResponse = {
  statusCode: HttpStatusCode.NO_CONTENT;
  header: IDeleteTodoSuccessResponseHeader;
};

export class DeleteTodoSuccessResponse
  extends HttpResponse<IDeleteTodoSuccessResponseHeader, undefined>
  implements IDeleteTodoSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.NO_CONTENT;

  public constructor(response: IDeleteTodoSuccessResponse) {
    super(response.statusCode, response.header, undefined);

    if (response.statusCode !== HttpStatusCode.NO_CONTENT) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for DeleteTodoSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IDeleteTodoSuccessResponses = IDeleteTodoSuccessResponse;

export type DeleteTodoSuccessResponses = DeleteTodoSuccessResponse;

export type IDeleteTodoResponse =
  | IDeleteTodoSuccessResponse
  | ITodoNotFoundErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type DeleteTodoResponse =
  | DeleteTodoSuccessResponse
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
