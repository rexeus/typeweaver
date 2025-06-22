import {
  type AwsHttpApiGatewayRoute,
  AwsHttpApiGatewayRouter,
  HttpMethod,
} from "@rexeus/typeweaver-core";

export class AdHttpApiRouter extends AwsHttpApiGatewayRouter {
  private routes: AwsHttpApiGatewayRoute[] = [
    {
      path: "/ads/{adId}",
      methods: [HttpMethod.GET],
    },

    {
      path: "/ads",
      methods: [HttpMethod.GET],
    },
  ];

  public constructor() {
    super();
  }

  public getRoutes(): AwsHttpApiGatewayRoute[] {
    return this.routes;
  }
}
