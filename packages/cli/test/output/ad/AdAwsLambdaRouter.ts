import {
  type AwsLambdaRoute,
  type AwsLambdaHandler,
  HttpMethod,
  AwsLambdaHttpRouter,
} from "@rexeus/typeweaver-core";

import type { IGetAdRequest } from "./GetAdRequest";
import type { GetAdSuccessResponses, IGetAdResponse } from "./GetAdResponse";
import { GetAdRequestValidator } from "./GetAdRequestValidator";

import type { IListAdRequest } from "./ListAdRequest";
import type { ListAdSuccessResponses, IListAdResponse } from "./ListAdResponse";
import { ListAdRequestValidator } from "./ListAdRequestValidator";

export type AdAwsLambdaRouterHandler = {
  handleGetAdRequest: AwsLambdaHandler<IGetAdRequest, GetAdSuccessResponses>;

  handleListAdRequest: AwsLambdaHandler<IListAdRequest, ListAdSuccessResponses>;
};

type AdRoutes = readonly [
  AwsLambdaRoute<
    HttpMethod.GET,
    "/ads/:adId",
    IGetAdRequest,
    IGetAdResponse,
    GetAdRequestValidator
  >,

  AwsLambdaRoute<
    HttpMethod.GET,
    "/ads",
    IListAdRequest,
    IListAdResponse,
    ListAdRequestValidator
  >,
];

export class AdAwsLambdaRouter extends AwsLambdaHttpRouter<AdRoutes> {
  private readonly routes: AdRoutes;

  public constructor(private readonly handler: AdAwsLambdaRouterHandler) {
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
