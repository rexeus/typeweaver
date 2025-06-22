import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  INonExistingProjectErrorResponse,
  NonExistingProjectErrorResponse,
} from "../shared/NonExistingProjectErrorResponse";

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

export type IListFunnelSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IListFunnelSuccessResponseBody = {
  results: {
    id: string;
    projectId: string;
    title: string;
    funnelHighlights: string;
    description: string;
    jobTitle: string;
    isFullTime: boolean;
    startAt:
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
      | "DECEMBER";
    workplace: "FULL_REMOTE" | "HYBRID" | "REMOTE_BY_CONSENT" | "ON_SITE";
    requiredDegree:
      | "NO_REQUIREMENT"
      | "LOWER_SECONDARY_SCHOOL"
      | "INTERMEDIATE_SECONDARY_SCHOOL"
      | "HIGHER_SECONDARY_SCHOOL"
      | "VOCATIONAL_TRAINING"
      | "BACHELOR"
      | "MASTER";
    companyDescription: string;
    aboutUs: {
      emoji: string;
      text: string;
    }[];
    benefits: {
      emoji: string;
      text: string;
    }[];
    applicantProfile: {
      emoji: string;
      text: string;
    }[];
    firstQualificationCheck: string;
    greeting: string;
    callToAction: string;
    images: {
      sequence: number;
      title: string;
      smallUrl: string;
      mediumUrl: string;
      largeUrl: string;
      fallbackUrl: string;
    }[];
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

export type IListFunnelSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IListFunnelSuccessResponseHeader;
  body: IListFunnelSuccessResponseBody;
};

export class ListFunnelSuccessResponse
  extends HttpResponse<
    IListFunnelSuccessResponseHeader,
    IListFunnelSuccessResponseBody
  >
  implements IListFunnelSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IListFunnelSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ListFunnelSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IListFunnelSuccessResponses = IListFunnelSuccessResponse;

export type ListFunnelSuccessResponses = ListFunnelSuccessResponse;

export type IListFunnelResponse =
  | IListFunnelSuccessResponse
  | INonExistingProjectErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type ListFunnelResponse =
  | ListFunnelSuccessResponse
  | NonExistingProjectErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
