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

export type IListSubTodosSuccessResponseHeader = {
  "Content-Type": "application/json";
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type IListSubTodosSuccessResponseBody = {
  results: {
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
  }[];
  nextToken?: string | undefined;
};

export type IListSubTodosSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IListSubTodosSuccessResponseHeader;
  body: IListSubTodosSuccessResponseBody;
};

export class ListSubTodosSuccessResponse
  extends HttpResponse<
    IListSubTodosSuccessResponseHeader,
    IListSubTodosSuccessResponseBody
  >
  implements IListSubTodosSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IListSubTodosSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ListSubTodosSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IListSubTodosSuccessResponses = IListSubTodosSuccessResponse;

export type ListSubTodosSuccessResponses = ListSubTodosSuccessResponse;

export type IListSubTodosResponse =
  | IListSubTodosSuccessResponse
  | ITodoNotFoundErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type ListSubTodosResponse =
  | ListSubTodosSuccessResponse
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
