import definition from "../../definition/auth/RefreshTokenDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { RefreshTokenResponseValidator } from "./RefreshTokenResponseValidator";
import type {
  IRefreshTokenRequest,
  IRefreshTokenRequestHeader,
  IRefreshTokenRequestBody,
  SuccessfulRefreshTokenResponse,
} from "./RefreshTokenRequest";

import { RefreshTokenSuccessResponse } from "./RefreshTokenResponse";

export class RefreshTokenRequestCommand
  extends RequestCommand
  implements IRefreshTokenRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: IRefreshTokenRequestHeader;
  declare public readonly param: undefined;
  declare public readonly query: undefined;
  public override readonly body: IRefreshTokenRequestBody;

  private readonly responseValidator: RefreshTokenResponseValidator;

  public constructor(input: Omit<IRefreshTokenRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.body = input.body;

    this.responseValidator = new RefreshTokenResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulRefreshTokenResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof RefreshTokenSuccessResponse) {
      return result;
    }

    throw result;
  }
}
