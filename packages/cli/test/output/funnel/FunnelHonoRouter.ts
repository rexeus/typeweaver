import {
  type HonoHttpRoute,
  type HonoHttpRequestHandler,
  HttpMethod,
  HonoHttpRouter,
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

export type FunnelHonoRouterHandler = {
  handleGetFunnelRequest: HonoHttpRequestHandler<
    IGetFunnelRequest,
    GetFunnelSuccessResponses
  >;

  handleGetPublicFunnelRequest: HonoHttpRequestHandler<
    IGetPublicFunnelRequest,
    GetPublicFunnelSuccessResponses
  >;

  handleListFunnelRequest: HonoHttpRequestHandler<
    IListFunnelRequest,
    ListFunnelSuccessResponses
  >;
};

type FunnelRoutes = readonly [
  HonoHttpRoute<
    HttpMethod.GET,
    "/funnels/:funnelId",
    IGetFunnelRequest,
    IGetFunnelResponse,
    GetFunnelRequestValidator
  >,

  HonoHttpRoute<
    HttpMethod.GET,
    "/public-funnels/:funnelId",
    IGetPublicFunnelRequest,
    IGetPublicFunnelResponse,
    GetPublicFunnelRequestValidator
  >,

  HonoHttpRoute<
    HttpMethod.GET,
    "/funnels",
    IListFunnelRequest,
    IListFunnelResponse,
    ListFunnelRequestValidator
  >,
];

export class FunnelHonoRouter extends HonoHttpRouter<FunnelRoutes> {
  private readonly routes: FunnelRoutes;

  public constructor(private readonly handler: FunnelHonoRouterHandler) {
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
