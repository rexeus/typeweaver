import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  AccessTokenSuccessResponse,
  RefreshTokenSuccessResponse,
  type AuthApiHandler,
  type IAccessTokenRequest,
  type AccessTokenResponse,
  type IRefreshTokenRequest,
  type RefreshTokenResponse,
  createAccessTokenSuccessResponse,
  createRefreshTokenSuccessResponse,
} from "../..";

export class AuthHandlers implements AuthApiHandler {
  public constructor(private readonly throwError?: Error | HttpResponse) {
    //
  }

  public async handleAccessTokenRequest(
    _request: IAccessTokenRequest
  ): Promise<AccessTokenResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createAccessTokenSuccessResponse();
    return new AccessTokenSuccessResponse(response);
  }

  public async handleRefreshTokenRequest(
    _request: IRefreshTokenRequest
  ): Promise<RefreshTokenResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    const response = createRefreshTokenSuccessResponse();
    return new RefreshTokenSuccessResponse(response);
  }
}
