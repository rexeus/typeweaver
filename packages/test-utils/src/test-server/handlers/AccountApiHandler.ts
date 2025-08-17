import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  createRegisterAccountSuccessResponse,
  RegisterAccountSuccessResponse,
} from "../..";
import type {
  AccountApiHandler,
  IRegisterAccountRequest,
  RegisterAccountResponse,
} from "../..";

export class AccountHandlers implements AccountApiHandler {
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
