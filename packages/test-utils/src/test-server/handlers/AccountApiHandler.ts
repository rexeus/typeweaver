import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { createRegisterAccountSuccessResponse } from "../../index.js";
import { RegisterAccountDefinition } from "../../test-project/spec/account/index.js";
import type {
  IRawRegisterAccountRequest,
  RegisterAccountResponse,
} from "../../index.js";
import type { HonoAccountApiHandler } from "../../test-project/output/account/AccountHono.js";

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
