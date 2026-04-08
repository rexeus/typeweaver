import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import { createRegisterAccountSuccessResponse } from "../../data/index.js";
import type {
  IRegisterAccountRequest,
  RegisterAccountResponse,
} from "../../index.js";
import type { ServerAccountApiHandler } from "../../test-project/output/account/AccountRouter.js";

export class ServerAccountHandlers implements ServerAccountApiHandler {
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
