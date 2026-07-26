import type { ITypedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createAccessTokenSuccessResponse,
  createRefreshTokenSuccessResponse,
} from "../../data/index.js";
import type {
  AccessTokenResponse,
  IRawAccessTokenRequest,
  IRawRefreshTokenRequest,
  RefreshTokenResponse,
} from "../../index.js";
import type { HonoAuthApiHandler } from "../../test-project/output/auth/AuthHono.js";

export class AuthHandlers implements HonoAuthApiHandler<boolean> {
  public constructor(private readonly throwError?: Error | ITypedHttpResponse) {
    //
  }

  public async handleAccessTokenRequest(
    _request: IRawAccessTokenRequest
  ): Promise<AccessTokenResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createAccessTokenSuccessResponse();
  }

  public async handleRefreshTokenRequest(
    _request: IRawRefreshTokenRequest
  ): Promise<RefreshTokenResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createRefreshTokenSuccessResponse();
  }
}
