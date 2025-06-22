import {
  type AwsLambdaRoute,
  type AwsLambdaHandler,
  HttpMethod,
  AwsLambdaHttpRouter,
} from "@rexeus/typeweaver-core";

import type { IGetFunnelRequest } from "./GetFunnelRequest";
import type {
  GetFunnelSuccessResponses,
  IGetFunnelResponse,
} from "./GetFunnelResponse";
import { GetFunnelRequestValidator } from "./GetFunnelRequestValidator";

import type { IGetPublicFunnelRequest } from "./GetPublicFunnelRequest";
import type {
  GetPublicFunnelSuccessResponses,
  IGetPublicFunnelResponse,
} from "./GetPublicFunnelResponse";
import { GetPublicFunnelRequestValidator } from "./GetPublicFunnelRequestValidator";

import type { IListFunnelRequest } from "./ListFunnelRequest";
import type {
  ListFunnelSuccessResponses,
  IListFunnelResponse,
} from "./ListFunnelResponse";
import { ListFunnelRequestValidator } from "./ListFunnelRequestValidator";

export type FunnelAwsLambdaRouterHandler = {
  handleGetFunnelRequest: AwsLambdaHandler<
    IGetFunnelRequest,
    GetFunnelSuccessResponses
  >;

  handleGetPublicFunnelRequest: AwsLambdaHandler<
    IGetPublicFunnelRequest,
    GetPublicFunnelSuccessResponses
  >;

  handleListFunnelRequest: AwsLambdaHandler<
    IListFunnelRequest,
    ListFunnelSuccessResponses
  >;
};

type FunnelRoutes = readonly [
  AwsLambdaRoute<
    HttpMethod.GET,
    "/funnels/:funnelId",
    IGetFunnelRequest,
    IGetFunnelResponse,
    GetFunnelRequestValidator
  >,

  AwsLambdaRoute<
    HttpMethod.GET,
    "/public-funnels/:funnelId",
    IGetPublicFunnelRequest,
    IGetPublicFunnelResponse,
    GetPublicFunnelRequestValidator
  >,

  AwsLambdaRoute<
    HttpMethod.GET,
    "/funnels",
    IListFunnelRequest,
    IListFunnelResponse,
    ListFunnelRequestValidator
  >,
];

export class FunnelAwsLambdaRouter extends AwsLambdaHttpRouter<FunnelRoutes> {
  private readonly routes: FunnelRoutes;

  public constructor(private readonly handler: FunnelAwsLambdaRouterHandler) {
    super();

    this.routes = [
      {
        path: "/funnels/:funnelId",
        method: HttpMethod.GET,
        handler: this.handler.handleGetFunnelRequest,
        validator: new GetFunnelRequestValidator(),
      },

      {
        path: "/public-funnels/:funnelId",
        method: HttpMethod.GET,
        handler: this.handler.handleGetPublicFunnelRequest,
        validator: new GetPublicFunnelRequestValidator(),
      },

      {
        path: "/funnels",
        method: HttpMethod.GET,
        handler: this.handler.handleListFunnelRequest,
        validator: new ListFunnelRequestValidator(),
      },
    ] as const;
  }

  public getRoutes(): FunnelRoutes {
    return this.routes;
  }
}
