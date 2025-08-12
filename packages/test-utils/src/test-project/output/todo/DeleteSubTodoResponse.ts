import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  ISubTodoNotFoundErrorResponse,
  SubTodoNotFoundErrorResponse,
} from "./SubTodoNotFoundErrorResponse";

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

export type IDeleteSubTodoSuccessResponseHeader = {
  "Content-Type": "application/json";
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type IDeleteSubTodoSuccessResponseBody = {
  message: string;
};

export type IDeleteSubTodoSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IDeleteSubTodoSuccessResponseHeader;
  body: IDeleteSubTodoSuccessResponseBody;
};

export class DeleteSubTodoSuccessResponse
  extends HttpResponse<
    IDeleteSubTodoSuccessResponseHeader,
    IDeleteSubTodoSuccessResponseBody
  >
  implements IDeleteSubTodoSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IDeleteSubTodoSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for DeleteSubTodoSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IDeleteSubTodoSuccessResponses = IDeleteSubTodoSuccessResponse;

export type DeleteSubTodoSuccessResponses = DeleteSubTodoSuccessResponse;

export type IDeleteSubTodoResponse =
  | IDeleteSubTodoSuccessResponse
  | ISubTodoNotFoundErrorResponse
  | ITodoNotFoundErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type DeleteSubTodoResponse =
  | DeleteSubTodoSuccessResponse
  | SubTodoNotFoundErrorResponse
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
