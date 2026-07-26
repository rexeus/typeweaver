import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { createRegisterAccountSuccessResponse } from "../../index.js";
import { RegisterAccountDefinition } from "../../test-project/spec/account/index.js";
import type {
  IRawRegisterAccountRequest,
  RegisterAccountResponse,
} from "../../index.js";
import type { ServerAccountApiHandler } from "../../test-project/output/account/AccountRouter.js";

export class ServerAccountHandlers implements ServerAccountApiHandler<
  Record<string, unknown>,
  boolean
> {
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
