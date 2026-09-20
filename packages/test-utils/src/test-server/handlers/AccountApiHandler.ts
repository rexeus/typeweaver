import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { createRegisterAccountSuccessResponse } from "../../data/account/index.js";
import { RegisterAccountDefinition } from "../../test-project/spec/account/index.js";
import type { HonoAccountApiHandler } from "../../test-project/output/account/AccountHono.js";
import type { IRawRegisterAccountRequest } from "../../test-project/output/account/RegisterAccountRequest.js";
import type { RegisterAccountResponse } from "../../test-project/output/account/RegisterAccountResponse.js";

export class AccountHandlers implements HonoAccountApiHandler<boolean> {
  public constructor(private readonly throwError?: Error | ITypedHttpResponse) {
    //
  }

  public async handleRegisterAccountRequest(
    request: IRawRegisterAccountRequest
  ): Promise<RegisterAccountResponse> {
    if (this.throwError) {
      throw this.throwError;
    }
    const body = RegisterAccountDefinition.request.body.parse(request.body);

    return createRegisterAccountSuccessResponse({
      body: { email: body.email },
    });
  }
}
