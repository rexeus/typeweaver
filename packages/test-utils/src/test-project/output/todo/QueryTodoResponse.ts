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

export type IQueryTodoSuccessResponseHeader = {
  "Content-Type": "application/json";
  "X-Single-Value"?: string | undefined;
  "X-Multi-Value"?: string[] | undefined;
};

export type IQueryTodoSuccessResponseBody = {
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

export type IQueryTodoSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IQueryTodoSuccessResponseHeader;
  body: IQueryTodoSuccessResponseBody;
};

export class QueryTodoSuccessResponse
  extends HttpResponse<
    IQueryTodoSuccessResponseHeader,
    IQueryTodoSuccessResponseBody
  >
  implements IQueryTodoSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IQueryTodoSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for QueryTodoSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IQueryTodoSuccessResponses = IQueryTodoSuccessResponse;

export type QueryTodoSuccessResponses = QueryTodoSuccessResponse;

export type IQueryTodoResponse =
  | IQueryTodoSuccessResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type QueryTodoResponse =
  | QueryTodoSuccessResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
