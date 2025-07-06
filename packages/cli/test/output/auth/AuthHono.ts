import type { Context } from "hono";
import { TypeweaverHono, type HonoRequestHandler } from "../lib/hono";

import type { IAccessTokenRequest } from "./AccessTokenRequest";
import { AccessTokenRequestValidator } from "./AccessTokenRequestValidator";
import type { AccessTokenResponse } from "./AccessTokenResponse";

import type { ILogoutRequest } from "./LogoutRequest";
import { LogoutRequestValidator } from "./LogoutRequestValidator";
import type { LogoutResponse } from "./LogoutResponse";

import type { IRefreshTokenRequest } from "./RefreshTokenRequest";
import { RefreshTokenRequestValidator } from "./RefreshTokenRequestValidator";
import type { RefreshTokenResponse } from "./RefreshTokenResponse";

export type AuthApiHandler = {
  handleAccessTokenRequest: HonoRequestHandler<
    IAccessTokenRequest,
    AccessTokenResponse
  >;

  handleLogoutRequest: HonoRequestHandler<ILogoutRequest, LogoutResponse>;

  handleRefreshTokenRequest: HonoRequestHandler<
    IRefreshTokenRequest,
    RefreshTokenResponse
  >;
};

export class AuthHono extends TypeweaverHono<AuthApiHandler> {
  public constructor(handlers: AuthApiHandler) {
    super({ requestHandlers: handlers });
    this.setupRoutes();
  }

  protected setupRoutes(): void {
    this.post("/auth/access-token", async (context: Context) =>
      this.handleRequest(
        context,
        new AccessTokenRequestValidator(),
        this.requestHandlers.handleAccessTokenRequest,
      ),
    );

    this.post("/auth/logout", async (context: Context) =>
      this.handleRequest(
        context,
        new LogoutRequestValidator(),
        this.requestHandlers.handleLogoutRequest,
      ),
    );

    this.post("/auth/refresh-token", async (context: Context) =>
      this.handleRequest(
        context,
        new RefreshTokenRequestValidator(),
        this.requestHandlers.handleRefreshTokenRequest,
      ),
    );
  }
}
