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

export type IListTodosSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IListTodosSuccessResponseBody = {
  results: {
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
  }[];
  nextToken?: string | undefined;
};

export type IListTodosSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IListTodosSuccessResponseHeader;
  body: IListTodosSuccessResponseBody;
};

export class ListTodosSuccessResponse
  extends HttpResponse<
    IListTodosSuccessResponseHeader,
    IListTodosSuccessResponseBody
  >
  implements IListTodosSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IListTodosSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ListTodosSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IListTodosSuccessResponses = IListTodosSuccessResponse;

export type ListTodosSuccessResponses = ListTodosSuccessResponse;

export type IListTodosResponse =
  | IListTodosSuccessResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type ListTodosResponse =
  | ListTodosSuccessResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
