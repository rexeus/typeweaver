import { HttpResponse, HttpStatusCode } from "@rexeus/typeweaver-core";
import {
  AccessTokenSuccessResponse,
  RefreshTokenSuccessResponse,
  type AuthApiHandler,
  type IAccessTokenRequest,
  type AccessTokenResponse,
  type IRefreshTokenRequest,
  type RefreshTokenResponse,
} from "../..";
import { faker } from "@faker-js/faker";

export class AuthHandlers implements AuthApiHandler {
  public constructor(private readonly throwError?: Error | HttpResponse) {
    //
  }

  public async handleAccessTokenRequest(
    request: IAccessTokenRequest
  ): Promise<AccessTokenResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const accessToken = faker.string.alphanumeric(64);
    const refreshToken = faker.string.alphanumeric(64);

    return new AccessTokenSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        accessToken,
        refreshToken,
      },
    });
  }

  public async handleRefreshTokenRequest(
    request: IRefreshTokenRequest
  ): Promise<RefreshTokenResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const accessToken = faker.string.alphanumeric(64);
    const refreshToken = faker.string.alphanumeric(64);

    return new RefreshTokenSuccessResponse({
      statusCode: HttpStatusCode.OK,
      header: {
        "Content-Type": "application/json",
      },
      body: {
        accessToken,
        refreshToken,
      },
    });
  }
}
