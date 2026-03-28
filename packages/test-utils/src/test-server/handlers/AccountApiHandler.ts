import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { createRegisterAccountSuccessResponse } from "../../data";
import type { IRegisterAccountRequest, RegisterAccountResponse } from "../..";
import type { HonoAccountApiHandler } from "../../test-project/output/account/AccountHono";

export class AccountHandlers implements HonoAccountApiHandler {
  public constructor(private readonly throwError?: Error | ITypedHttpResponse) {
    //
  }

  public async handleRegisterAccountRequest(
    request: IRegisterAccountRequest
  ): Promise<RegisterAccountResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createRegisterAccountSuccessResponse({
      body: request.body,
    });
  }
}
