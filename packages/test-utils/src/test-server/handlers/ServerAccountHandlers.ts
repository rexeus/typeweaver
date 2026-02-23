import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  createRegisterAccountSuccessResponse,
  RegisterAccountSuccessResponse,
} from "../..";
import type { IRegisterAccountRequest, RegisterAccountResponse } from "../..";
import type { AccountApiHandler } from "../../test-project/output/account/AccountRouter";

export class ServerAccountHandlers implements AccountApiHandler {
  public constructor(private readonly throwError?: Error | HttpResponse) {
    //
  }

  public async handleRegisterAccountRequest(
    request: IRegisterAccountRequest
  ): Promise<RegisterAccountResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createRegisterAccountSuccessResponse({
      body: request.body,
    });

    return new RegisterAccountSuccessResponse(response);
  }
}
