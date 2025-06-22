import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";

import type {
  IAdNotFoundErrorResponse,
  AdNotFoundErrorResponse,
} from "../shared/AdNotFoundErrorResponse";

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

export type IGetAdSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IGetAdSuccessResponseBody = {
  id: string;
  projectId: string;
  instagram: {
    headline: string;
    description: string;
    imageUrl: string;
    callToAction: string;
    hashtags: string[];
  };
  facebook: {
    headline: string;
    description: string;
    imageUrl: string;
    callToAction: string;
    hashtags: string[];
  };
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

export type IGetAdSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IGetAdSuccessResponseHeader;
  body: IGetAdSuccessResponseBody;
};

export class GetAdSuccessResponse
  extends HttpResponse<IGetAdSuccessResponseHeader, IGetAdSuccessResponseBody>
  implements IGetAdSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IGetAdSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for GetAdSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IGetAdSuccessResponses = IGetAdSuccessResponse;

export type GetAdSuccessResponses = GetAdSuccessResponse;

export type IGetAdResponse =
  | IGetAdSuccessResponse
  | IAdNotFoundErrorResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type GetAdResponse =
  | GetAdSuccessResponse
  | AdNotFoundErrorResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
