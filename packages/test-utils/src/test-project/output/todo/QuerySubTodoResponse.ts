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

export type IQuerySubTodoSuccessResponseHeader = {
  "Content-Type": "application/json";
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type IQuerySubTodoSuccessResponseBody = {
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

export type IQuerySubTodoSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IQuerySubTodoSuccessResponseHeader;
  body: IQuerySubTodoSuccessResponseBody;
};

export class QuerySubTodoSuccessResponse
  extends HttpResponse<
    IQuerySubTodoSuccessResponseHeader,
    IQuerySubTodoSuccessResponseBody
  >
  implements IQuerySubTodoSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IQuerySubTodoSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for QuerySubTodoSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IQuerySubTodoSuccessResponses = IQuerySubTodoSuccessResponse;

export type QuerySubTodoSuccessResponses = QuerySubTodoSuccessResponse;

export type IQuerySubTodoResponse =
  | IQuerySubTodoSuccessResponse
  | ITodoNotFoundErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type QuerySubTodoResponse =
  | QuerySubTodoSuccessResponse
  | TodoNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
