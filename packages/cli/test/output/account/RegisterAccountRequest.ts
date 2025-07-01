import definition from "../../definition/account/RegisterAccountDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { RegisterAccountResponseValidator } from "./RegisterAccountResponseValidator";
import {
  type RegisterAccountResponse,
  RegisterAccountSuccessResponse,
} from "./RegisterAccountResponse";

import { ForbiddenErrorResponse } from "../shared/ForbiddenErrorResponse";

import { InternalServerErrorResponse } from "../shared/InternalServerErrorResponse";

import { TooManyRequestsErrorResponse } from "../shared/TooManyRequestsErrorResponse";

import { UnauthorizedErrorResponse } from "../shared/UnauthorizedErrorResponse";

import { UnsupportedMediaTypeErrorResponse } from "../shared/UnsupportedMediaTypeErrorResponse";

import { ValidationErrorResponse } from "../shared/ValidationErrorResponse";

export type IRegisterAccountRequestHeader = {
  "Content-Type": "application/json";
  Accept: "application/json";
};

export type IRegisterAccountRequestBody = {
  email: string;
  password: string;
};

export type IRegisterAccountRequest = {
  path: string;
  method: HttpMethod.POST;
  header: IRegisterAccountRequestHeader;

  body: IRegisterAccountRequestBody;
};

export type SuccessfulRegisterAccountResponse = Exclude<
  RegisterAccountResponse,
  | ForbiddenErrorResponse
  | InternalServerErrorResponse
  | TooManyRequestsErrorResponse
  | UnauthorizedErrorResponse
  | UnsupportedMediaTypeErrorResponse
  | ValidationErrorResponse
>;

export class RegisterAccountRequestCommand
  extends RequestCommand
  implements IRegisterAccountRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: IRegisterAccountRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  public override readonly body: IRegisterAccountRequestBody;

  private readonly responseValidator: RegisterAccountResponseValidator;

  public constructor(input: Omit<IRegisterAccountRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.body = input.body;

    this.responseValidator = new RegisterAccountResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulRegisterAccountResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof RegisterAccountSuccessResponse) {
      return result;
    }

    throw result;
  }
}
