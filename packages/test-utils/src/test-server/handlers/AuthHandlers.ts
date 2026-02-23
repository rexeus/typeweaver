import { HttpResponse } from "@rexeus/typeweaver-core";
import {
  AccessTokenSuccessResponse,
  createAccessTokenSuccessResponse,
  createRefreshTokenSuccessResponse,
  RefreshTokenSuccessResponse,
} from "../..";
import type {
  AccessTokenResponse,
  IAccessTokenRequest,
  IRefreshTokenRequest,
  RefreshTokenResponse,
} from "../..";
import type { AuthApiHandler } from "../../test-project/output/auth/AuthHono";

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
