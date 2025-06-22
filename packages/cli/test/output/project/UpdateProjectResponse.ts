import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  IProjectNotFoundErrorResponse,
  ProjectNotFoundErrorResponse,
} from "../shared/ProjectNotFoundErrorResponse";

import type {
  INotUpdateableProjectStatusErrorResponse,
  NotUpdateableProjectStatusErrorResponse,
} from "../shared/NotUpdateableProjectStatusErrorResponse";

import type {
  INonExistingFunnelErrorResponse,
  NonExistingFunnelErrorResponse,
} from "../shared/NonExistingFunnelErrorResponse";

import type {
  INonExistingAdErrorResponse,
  NonExistingAdErrorResponse,
} from "../shared/NonExistingAdErrorResponse";

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

export type IUpdateProjectSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IUpdateProjectSuccessResponseBody = {
  id: string;
  accountId: string;
  title: string;
  status:
    | "INITIAL"
    | "DRAFT"
    | "REQUEST_GENERATION"
    | "IN_GENERATION"
    | "IN_REVIEW"
    | "PUBLISHED"
    | "WITHDRAWN";
  isReadyForGeneration: boolean;
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
  selectedAdId?: (string | null) | undefined;
  selectedFunnelId?: (string | null) | undefined;
  createdAt: string;
  modifiedAt: string;
  createdBy:
    | {
        type: "ACCOUNT";
        accountId: string;
        cause: string;
      }
    | {
        type: "USER";
        userId: string;
        cause: string;
      }
    | {
        type: "SERVICE";
        serviceCode: string;
        cause: string;
      }
    | {
        type: "UNKNOWN";
        cause: string;
      }
    | {
        type: "SYSTEM";
        componentCode: string;
        cause: string;
      };
  modifiedBy:
    | {
        type: "ACCOUNT";
        accountId: string;
        cause: string;
      }
    | {
        type: "USER";
        userId: string;
        cause: string;
      }
    | {
        type: "SERVICE";
        serviceCode: string;
        cause: string;
      }
    | {
        type: "UNKNOWN";
        cause: string;
      }
    | {
        type: "SYSTEM";
        componentCode: string;
        cause: string;
      };
};

export type IUpdateProjectSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IUpdateProjectSuccessResponseHeader;
  body: IUpdateProjectSuccessResponseBody;
};

export class UpdateProjectSuccessResponse
  extends HttpResponse<
    IUpdateProjectSuccessResponseHeader,
    IUpdateProjectSuccessResponseBody
  >
  implements IUpdateProjectSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IUpdateProjectSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for UpdateProjectSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IUpdateProjectSuccessResponses = IUpdateProjectSuccessResponse;

export type UpdateProjectSuccessResponses = UpdateProjectSuccessResponse;

export type IUpdateProjectResponse =
  | IUpdateProjectSuccessResponse
  | IProjectNotFoundErrorResponse
  | INotUpdateableProjectStatusErrorResponse
  | INonExistingFunnelErrorResponse
  | INonExistingAdErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type UpdateProjectResponse =
  | UpdateProjectSuccessResponse
  | ProjectNotFoundErrorResponse
  | NotUpdateableProjectStatusErrorResponse
  | NonExistingFunnelErrorResponse
  | NonExistingAdErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
