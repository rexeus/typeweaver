import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  IFunnelNotFoundErrorResponse,
  FunnelNotFoundErrorResponse,
} from "../shared/FunnelNotFoundErrorResponse";

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

export type IGetPublicFunnelSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IGetPublicFunnelSuccessResponseBody = {
  id: string;
  title: string;
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
};

export type IGetPublicFunnelSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IGetPublicFunnelSuccessResponseHeader;
  body: IGetPublicFunnelSuccessResponseBody;
};

export class GetPublicFunnelSuccessResponse
  extends HttpResponse<
    IGetPublicFunnelSuccessResponseHeader,
    IGetPublicFunnelSuccessResponseBody
  >
  implements IGetPublicFunnelSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IGetPublicFunnelSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for GetPublicFunnelSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IGetPublicFunnelSuccessResponses = IGetPublicFunnelSuccessResponse;

export type GetPublicFunnelSuccessResponses = GetPublicFunnelSuccessResponse;

export type IGetPublicFunnelResponse =
  | IGetPublicFunnelSuccessResponse
  | IFunnelNotFoundErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type GetPublicFunnelResponse =
  | GetPublicFunnelSuccessResponse
  | FunnelNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
