import definition from "../../definition/project/GetProjectDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { GetProjectResponseValidator } from "./GetProjectResponseValidator";
import {
  type GetProjectResponse,
  GetProjectSuccessResponse,
} from "./GetProjectResponse";

import { ProjectNotFoundErrorResponse } from "../shared/ProjectNotFoundErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IGetProjectRequestHeader = {
  Accept: "application/json";
  Authorization: string;
};

export type IGetProjectRequestParam = {
  projectId: string;
};

export type IGetProjectRequest = {
  path: string;
  method: HttpMethod.GET;
  header: IGetProjectRequestHeader;
  param: IGetProjectRequestParam;
};

export type SuccessfulGetProjectResponse = Exclude<
  GetProjectResponse,
  | ProjectNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class GetProjectRequestCommand
  extends RequestCommand
  implements IGetProjectRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IGetProjectRequestHeader;
  public override readonly param: IGetProjectRequestParam;
  declare public readonly query: undefined;
  declare public readonly body: undefined;

  private readonly responseValidator: GetProjectResponseValidator;

  public constructor(input: Omit<IGetProjectRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.responseValidator = new GetProjectResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulGetProjectResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof GetProjectSuccessResponse) {
      return result;
    }

    throw result;
  }
}
