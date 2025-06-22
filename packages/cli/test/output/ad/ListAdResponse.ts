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

export type IListAdSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IListAdSuccessResponseBody = {
  results: {
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
  }[];
  nextToken?: string | undefined;
};

export type IListAdSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IListAdSuccessResponseHeader;
  body: IListAdSuccessResponseBody;
};

export class ListAdSuccessResponse
  extends HttpResponse<IListAdSuccessResponseHeader, IListAdSuccessResponseBody>
  implements IListAdSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IListAdSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for ListAdSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IListAdSuccessResponses = IListAdSuccessResponse;

export type ListAdSuccessResponses = ListAdSuccessResponse;

export type IListAdResponse =
  | IListAdSuccessResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type ListAdResponse =
  | ListAdSuccessResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
