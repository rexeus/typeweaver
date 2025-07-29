import definition from "../../definition/account/RegisterAccountDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { RegisterAccountResponseValidator } from "./RegisterAccountResponseValidator";
import type {
  IRegisterAccountRequest,
  IRegisterAccountRequestHeader,
  IRegisterAccountRequestBody,
  SuccessfulRegisterAccountResponse,
} from "./RegisterAccountRequest";

import { RegisterAccountSuccessResponse } from "./RegisterAccountResponse";

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
