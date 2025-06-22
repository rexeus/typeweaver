import {
  type HonoHttpRoute,
  type HonoHttpRequestHandler,
  HttpMethod,
  HonoHttpRouter,
} from "@rexeus/typeweaver-core";

import type { IGetAdRequest } from "./GetAdRequest";
import type { GetAdSuccessResponses, IGetAdResponse } from "./GetAdResponse";
import { GetAdRequestValidator } from "./GetAdRequestValidator";

import type { IListAdRequest } from "./ListAdRequest";
import type { ListAdSuccessResponses, IListAdResponse } from "./ListAdResponse";
import { ListAdRequestValidator } from "./ListAdRequestValidator";

export type AdHonoRouterHandler = {
  handleGetAdRequest: HonoHttpRequestHandler<
    IGetAdRequest,
    GetAdSuccessResponses
  >;

  handleListAdRequest: HonoHttpRequestHandler<
    IListAdRequest,
    ListAdSuccessResponses
  >;
};

type AdRoutes = readonly [
  HonoHttpRoute<
    HttpMethod.GET,
    "/ads/:adId",
    IGetAdRequest,
    IGetAdResponse,
    GetAdRequestValidator
  >,

  HonoHttpRoute<
    HttpMethod.GET,
    "/ads",
    IListAdRequest,
    IListAdResponse,
    ListAdRequestValidator
  >,
];

export class AdHonoRouter extends HonoHttpRouter<AdRoutes> {
  private readonly routes: AdRoutes;

  public constructor(private readonly handler: AdHonoRouterHandler) {
    super();

    this.routes = [
      {
        path: "/ads/:adId",
        method: HttpMethod.GET,
        handler: this.handler.handleGetAdRequest,
        validator: new GetAdRequestValidator(),
      },

      {
        path: "/ads",
        method: HttpMethod.GET,
        handler: this.handler.handleListAdRequest,
        validator: new ListAdRequestValidator(),
      },
    ] as const;
  }

  public getRoutes(): AdRoutes {
    return this.routes;
  }
}
