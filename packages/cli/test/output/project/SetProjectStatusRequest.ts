import definition from "../../definition/project/SetProjectStatusDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { SetProjectStatusResponseValidator } from "./SetProjectStatusResponseValidator";
import {
  type SetProjectStatusResponse,
  SetProjectStatusSuccessResponse,
} from "./SetProjectStatusResponse";

import { ProjectNotFoundErrorResponse } from "../shared/ProjectNotFoundErrorResponse";

import { ProjectStatusTransitionErrorResponse } from "../shared/ProjectStatusTransitionErrorResponse";

import { ProjectPublishErrorResponse } from "../shared/ProjectPublishErrorResponse";

import { ProjectRequestGenerationErrorResponse } from "../shared/ProjectRequestGenerationErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type ISetProjectStatusRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type ISetProjectStatusRequestParam = {
  projectId: string;
};

export type ISetProjectStatusRequestBody = {
  value: "REQUEST_GENERATION" | "PUBLISHED" | "WITHDRAWN";
};

export type ISetProjectStatusRequest = {
  path: string;
  method: HttpMethod.PUT;
  header: ISetProjectStatusRequestHeader;
  param: ISetProjectStatusRequestParam;

  body: ISetProjectStatusRequestBody;
};

export type SuccessfulSetProjectStatusResponse = Exclude<
  SetProjectStatusResponse,
  | ProjectNotFoundErrorResponse
  | ProjectStatusTransitionErrorResponse
  | ProjectPublishErrorResponse
  | ProjectRequestGenerationErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class SetProjectStatusRequestCommand
  extends RequestCommand
  implements ISetProjectStatusRequest
{
  public override readonly method = definition.method as HttpMethod.PUT;
  public override readonly path = definition.path;

  public override readonly header: ISetProjectStatusRequestHeader;
  public override readonly param: ISetProjectStatusRequestParam;
  declare public readonly query: undefined;
  public override readonly body: ISetProjectStatusRequestBody;

  private readonly responseValidator: SetProjectStatusResponseValidator;

  public constructor(input: Omit<ISetProjectStatusRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.body = input.body;

    this.responseValidator = new SetProjectStatusResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulSetProjectStatusResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof SetProjectStatusSuccessResponse) {
      return result;
    }

    throw result;
  }
}
