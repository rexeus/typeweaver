import { HttpMethod } from "@rexeus/typeweaver-core";
import { type CreateTodoResponse } from "./CreateTodoResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type ICreateTodoRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type ICreateTodoRequestBody = {
  title: string;
  description?: string | undefined;
  dueDate?: string | undefined;
  tags?: string[] | undefined;
  priority?: ("LOW" | "MEDIUM" | "HIGH") | undefined;
};

export type ICreateTodoRequest = {
  path: string;
  method: HttpMethod.POST;
  header: ICreateTodoRequestHeader;

  body: ICreateTodoRequestBody;
};

export type SuccessfulCreateTodoResponse = Exclude<
  CreateTodoResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;
