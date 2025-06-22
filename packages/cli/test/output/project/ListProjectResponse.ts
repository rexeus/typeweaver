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

export type IListProjectSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IListProjectSuccessResponseBody = {
  results: {
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
  }[];
  nextToken?: string | undefined;
};

export type IListProjectSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IListProjectSuccessResponseHeader;
  body: IListProjectSuccessResponseBody;
};

export class ListProjectSuccessResponse
  extends HttpResponse<
    IListProjectSuccessResponseHeader,
    IListProjectSuccessResponseBody
  >
  implements IListProjectSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IListProjectSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ListProjectSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IListProjectSuccessResponses = IListProjectSuccessResponse;

export type ListProjectSuccessResponses = ListProjectSuccessResponse;

export type IListProjectResponse =
  | IListProjectSuccessResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type ListProjectResponse =
  | ListProjectSuccessResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
