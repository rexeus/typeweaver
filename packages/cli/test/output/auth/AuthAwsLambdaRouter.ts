import {
  type AwsLambdaRoute,
  type AwsLambdaHandler,
  HttpMethod,
  AwsLambdaHttpRouter,
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

export type AuthAwsLambdaRouterHandler = {
  handleAccessTokenRequest: AwsLambdaHandler<
    IAccessTokenRequest,
    AccessTokenSuccessResponses
  >;

  handleLogoutRequest: AwsLambdaHandler<ILogoutRequest, LogoutSuccessResponses>;

  handleRefreshTokenRequest: AwsLambdaHandler<
    IRefreshTokenRequest,
    RefreshTokenSuccessResponses
  >;
};

type AuthRoutes = readonly [
  AwsLambdaRoute<
    HttpMethod.POST,
    "/auth/access-token",
    IAccessTokenRequest,
    IAccessTokenResponse,
    AccessTokenRequestValidator
  >,

  AwsLambdaRoute<
    HttpMethod.POST,
    "/auth/logout",
    ILogoutRequest,
    ILogoutResponse,
    LogoutRequestValidator
  >,

  AwsLambdaRoute<
    HttpMethod.POST,
    "/auth/refresh-token",
    IRefreshTokenRequest,
    IRefreshTokenResponse,
    RefreshTokenRequestValidator
  >,
];

export class AuthAwsLambdaRouter extends AwsLambdaHttpRouter<AuthRoutes> {
  private readonly routes: AuthRoutes;

  public constructor(private readonly handler: AuthAwsLambdaRouterHandler) {
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
