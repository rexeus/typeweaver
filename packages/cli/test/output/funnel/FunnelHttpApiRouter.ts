import {
  type AwsHttpApiGatewayRoute,
  AwsHttpApiGatewayRouter,
  HttpMethod,
} from "@rexeus/typeweaver-core";

export class FunnelHttpApiRouter extends AwsHttpApiGatewayRouter {
  private routes: AwsHttpApiGatewayRoute[] = [
    {
      path: "/funnels/{funnelId}",
      methods: [HttpMethod.GET],
    },

    {
      path: "/public-funnels/{funnelId}",
      methods: [HttpMethod.GET],
    },

    {
      path: "/funnels",
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
