import definition from "../../../definition/auth/AccessTokenDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { AccessTokenResponseValidator } from "./AccessTokenResponseValidator";
import type {
  IAccessTokenRequest,
  IAccessTokenRequestHeader,
  IAccessTokenRequestBody,
  SuccessfulAccessTokenResponse,
} from "./AccessTokenRequest";

import { AccessTokenSuccessResponse } from "./AccessTokenResponse";

export class AccessTokenRequestCommand
  extends RequestCommand
  implements IAccessTokenRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: IAccessTokenRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  public override readonly body: IAccessTokenRequestBody;

  private readonly responseValidator: AccessTokenResponseValidator;

  public constructor(input: Omit<IAccessTokenRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.body = input.body;

    this.responseValidator = new AccessTokenResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulAccessTokenResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof AccessTokenSuccessResponse) {
      return result;
    }

    throw result;
  }
}
