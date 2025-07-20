import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import {
  RegisterAccountSuccessResponse,
  type AccountApiHandler,
  type IRegisterAccountRequest,
  type RegisterAccountResponse,
} from "../..";
import { faker } from "@faker-js/faker";

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

    const isoDate = faker.date.recent().toISOString();
    const createdBy = faker.internet.username();
    return new RegisterAccountSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        id: faker.string.uuid(),
        email: request.body.email,
        createdAt: isoDate,
        modifiedAt: isoDate,
        createdBy: createdBy,
        modifiedBy: createdBy,
      },
    });
  }
}
