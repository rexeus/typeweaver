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

export type IRegisterAccountSuccessResponseHeader = {
  "Content-Type": "application/json";
};

export type IRegisterAccountSuccessResponseBody = {
  id: string;
  email: string;
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

export type IRegisterAccountSuccessResponse = {
  statusCode: HttpStatusCode.OK;
  header: IRegisterAccountSuccessResponseHeader;
  body: IRegisterAccountSuccessResponseBody;
};

export class RegisterAccountSuccessResponse
  extends HttpResponse<
    IRegisterAccountSuccessResponseHeader,
    IRegisterAccountSuccessResponseBody
  >
  implements IRegisterAccountSuccessResponse
{
  public override readonly statusCode: HttpStatusCode.OK;

  public constructor(response: IRegisterAccountSuccessResponse) {
    super(response.statusCode, response.header, response.body);

    if (response.statusCode !== HttpStatusCode.OK) {
      throw new Error(
        `Invalid status code: '${response.statusCode}' for RegisterAccountSuccessResponse`,
      );
    }

    this.statusCode = response.statusCode;
  }
}

export type IRegisterAccountSuccessResponses = IRegisterAccountSuccessResponse;

export type RegisterAccountSuccessResponses = RegisterAccountSuccessResponse;

export type IRegisterAccountResponse =
  | IRegisterAccountSuccessResponse
  | IForbiddenErrorResponse
  | IInternalServerErrorResponse
  | ITooManyRequestsErrorResponse
  | IUnauthorizedErrorResponse
  | IUnsupportedMediaTypeErrorResponse
  | IValidationErrorResponse;

export type RegisterAccountResponse =
  | RegisterAccountSuccessResponse
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse;
