import type { ITaggedHttpResponse } from "@rexeus/typeweaver-core";
import {
  createAccessTokenSuccessResponse,
  createRefreshTokenSuccessResponse,
} from "../../data";
import type {
  AccessTokenResponse,
  IAccessTokenRequest,
  IRefreshTokenRequest,
  RefreshTokenResponse,
} from "../..";
import type { HonoAuthApiHandler } from "../../test-project/output/auth/AuthHono";

export class AuthHandlers implements HonoAuthApiHandler {
  public constructor(
    private readonly throwError?: Error | ITaggedHttpResponse
  ) {
    //
  }

  public async handleAccessTokenRequest(
    _request: IAccessTokenRequest
  ): Promise<AccessTokenResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createAccessTokenSuccessResponse();
  }

  public async handleRefreshTokenRequest(
    _request: IRefreshTokenRequest
  ): Promise<RefreshTokenResponse> {
    if (this.throwError) {
      throw this.throwError;
    }

    return createRefreshTokenSuccessResponse();
  }
}
