import definition from "../../definition/project/UpdateProjectDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { UpdateProjectResponseValidator } from "./UpdateProjectResponseValidator";
import {
  type UpdateProjectResponse,
  UpdateProjectSuccessResponse,
} from "./UpdateProjectResponse";

import { ProjectNotFoundErrorResponse } from "../shared/ProjectNotFoundErrorResponse";

import { NotUpdateableProjectStatusErrorResponse } from "../shared/NotUpdateableProjectStatusErrorResponse";

import { NonExistingFunnelErrorResponse } from "../shared/NonExistingFunnelErrorResponse";

import { NonExistingAdErrorResponse } from "../shared/NonExistingAdErrorResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IUpdateProjectRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type IUpdateProjectRequestParam = {
  projectId: string;
};

export type IUpdateProjectRequestBody = {
  title?: string | undefined;
  jobTitle?: (string | undefined) | undefined;
  isFullTime?: (boolean | undefined) | undefined;
  startAt?:
    | (
        | (
            | "IMMEDIATE"
            | "SPRING"
            | "SUMMER"
            | "AUTUMN"
            | "WINTER"
            | "JANUARY"
            | "FEBRUARY"
            | "MARCH"
            | "APRIL"
            | "MAY"
            | "JUNE"
            | "JULY"
            | "AUGUST"
            | "SEPTEMBER"
            | "OCTOBER"
            | "NOVEMBER"
            | "DECEMBER"
          )
        | undefined
      )
    | undefined;
  workplace?:
    | (("FULL_REMOTE" | "HYBRID" | "REMOTE_BY_CONSENT" | "ON_SITE") | undefined)
    | undefined;
  requiredDegree?:
    | (
        | (
            | "NO_REQUIREMENT"
            | "LOWER_SECONDARY_SCHOOL"
            | "INTERMEDIATE_SECONDARY_SCHOOL"
            | "HIGHER_SECONDARY_SCHOOL"
            | "VOCATIONAL_TRAINING"
            | "BACHELOR"
            | "MASTER"
          )
        | undefined
      )
    | undefined;
  degreeTitle?: (string | undefined) | undefined;
  companyName?: (string | undefined) | undefined;
  aboutUs?: (string | undefined) | undefined;
  benefits?: (string | undefined) | undefined;
  applicantProfile?: (string | undefined) | undefined;
  selectedAdId?: ((string | null) | undefined) | undefined;
  selectedFunnelId?: ((string | null) | undefined) | undefined;
};

export type IUpdateProjectRequest = {
  path: string;
  method: HttpMethod.PATCH;
  header: IUpdateProjectRequestHeader;
  param: IUpdateProjectRequestParam;

  body: IUpdateProjectRequestBody;
};

export type SuccessfulUpdateProjectResponse = Exclude<
  UpdateProjectResponse,
  | ProjectNotFoundErrorResponse
  | NotUpdateableProjectStatusErrorResponse
  | NonExistingFunnelErrorResponse
  | NonExistingAdErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class UpdateProjectRequestCommand
  extends RequestCommand
  implements IUpdateProjectRequest
{
  public override readonly method = definition.method as HttpMethod.PATCH;
  public override readonly path = definition.path;

  public override readonly header: IUpdateProjectRequestHeader;
  public override readonly param: IUpdateProjectRequestParam;
  declare public readonly query: undefined;
  public override readonly body: IUpdateProjectRequestBody;

  private readonly responseValidator: UpdateProjectResponseValidator;

  public constructor(input: Omit<IUpdateProjectRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.body = input.body;

    this.responseValidator = new UpdateProjectResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulUpdateProjectResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof UpdateProjectSuccessResponse) {
      return result;
    }

    throw result;
  }
}
