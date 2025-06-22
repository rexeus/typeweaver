import {
  type HonoHttpRoute,
  type HonoHttpRequestHandler,
  HttpMethod,
  HonoHttpRouter,
} from "@rexeus/typeweaver-core";

import type { IAccessTokenRequest } from "./AccessTokenRequest";
import type {
  AccessTokenSuccessResponses,
  IAccessTokenResponse,
} from "./AccessTokenResponse";
import { AccessTokenRequestValidator } from "./AccessTokenRequestValidator";

import type { ILogoutRequest } from "./LogoutRequest";
import type { LogoutSuccessResponses, ILogoutResponse } from "./LogoutResponse";
import { LogoutRequestValidator } from "./LogoutRequestValidator";

import type { IRefreshTokenRequest } from "./RefreshTokenRequest";
import type {
  RefreshTokenSuccessResponses,
  IRefreshTokenResponse,
} from "./RefreshTokenResponse";
import { RefreshTokenRequestValidator } from "./RefreshTokenRequestValidator";

export type AuthHonoRouterHandler = {
  handleAccessTokenRequest: HonoHttpRequestHandler<
    IAccessTokenRequest,
    AccessTokenSuccessResponses
  >;

  handleLogoutRequest: HonoHttpRequestHandler<
    ILogoutRequest,
    LogoutSuccessResponses
  >;

  handleRefreshTokenRequest: HonoHttpRequestHandler<
    IRefreshTokenRequest,
    RefreshTokenSuccessResponses
  >;
};

type AuthRoutes = readonly [
  HonoHttpRoute<
    HttpMethod.POST,
    "/auth/access-token",
    IAccessTokenRequest,
    IAccessTokenResponse,
    AccessTokenRequestValidator
  >,

  HonoHttpRoute<
    HttpMethod.POST,
    "/auth/logout",
    ILogoutRequest,
    ILogoutResponse,
    LogoutRequestValidator
  >,

  HonoHttpRoute<
    HttpMethod.POST,
    "/auth/refresh-token",
    IRefreshTokenRequest,
    IRefreshTokenResponse,
    RefreshTokenRequestValidator
  >,
];

export class AuthHonoRouter extends HonoHttpRouter<AuthRoutes> {
  private readonly routes: AuthRoutes;

  public constructor(private readonly handler: AuthHonoRouterHandler) {
    super();

    this.routes = [
      {
        path: "/auth/access-token",
        method: HttpMethod.POST,
        handler: this.handler.handleAccessTokenRequest,
        validator: new AccessTokenRequestValidator(),
      },

      {
        path: "/auth/logout",
        method: HttpMethod.POST,
        handler: this.handler.handleLogoutRequest,
        validator: new LogoutRequestValidator(),
      },

      {
        path: "/auth/refresh-token",
        method: HttpMethod.POST,
        handler: this.handler.handleRefreshTokenRequest,
        validator: new RefreshTokenRequestValidator(),
      },
    ] as const;
  }

  public getRoutes(): AuthRoutes {
    return this.routes;
  }
}
