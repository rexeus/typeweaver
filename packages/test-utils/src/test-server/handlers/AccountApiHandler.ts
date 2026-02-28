import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  createRegisterAccountSuccessResponse,
  RegisterAccountSuccessResponse,
} from "../..";
import type { IRegisterAccountRequest, RegisterAccountResponse } from "../..";
import type { HonoAccountApiHandler } from "../../test-project/output/account/AccountHono";

export class AccountHandlers implements HonoAccountApiHandler {
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
