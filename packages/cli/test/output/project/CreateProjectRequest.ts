import definition from "../../definition/project/CreateProjectDefinition";
import {
  RequestCommand,
  HttpMethod,
  type IHttpResponse,
} from "@rexeus/typeweaver-core";
import { CreateProjectResponseValidator } from "./CreateProjectResponseValidator";
import {
  type CreateProjectResponse,
  CreateProjectSuccessResponse,
} from "./CreateProjectResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type ICreateProjectRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
  Authorization: string;
};

export type ICreateProjectRequestBody = {
  title: string;
  jobTitle?: string | undefined;
  isFullTime?: boolean | undefined;
  startAt?:
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
    | undefined;
  workplace?:
    | ("FULL_REMOTE" | "HYBRID" | "REMOTE_BY_CONSENT" | "ON_SITE")
    | undefined;
  requiredDegree?:
    | (
        | "NO_REQUIREMENT"
        | "LOWER_SECONDARY_SCHOOL"
        | "INTERMEDIATE_SECONDARY_SCHOOL"
        | "HIGHER_SECONDARY_SCHOOL"
        | "VOCATIONAL_TRAINING"
        | "BACHELOR"
        | "MASTER"
      )
    | undefined;
  degreeTitle?: string | undefined;
  companyName?: string | undefined;
  aboutUs?: string | undefined;
  benefits?: string | undefined;
  applicantProfile?: string | undefined;
};

export type ICreateProjectRequest = {
  path: string;
  method: HttpMethod.POST;
  header: ICreateProjectRequestHeader;

  body: ICreateProjectRequestBody;
};

export type SuccessfulCreateProjectResponse = Exclude<
  CreateProjectResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class CreateProjectRequestCommand
  extends RequestCommand
  implements ICreateProjectRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: ICreateProjectRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  public override readonly body: ICreateProjectRequestBody;

  private readonly responseValidator: CreateProjectResponseValidator;

  public constructor(input: Omit<ICreateProjectRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.body = input.body;

    this.responseValidator = new CreateProjectResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulCreateProjectResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof CreateProjectSuccessResponse) {
      return result;
    }

    throw result;
  }
}
