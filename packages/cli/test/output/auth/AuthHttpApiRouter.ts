import {
  type AwsHttpApiGatewayRoute,
  AwsHttpApiGatewayRouter,
  HttpMethod,
} from "@rexeus/typeweaver-core";

export class AuthHttpApiRouter extends AwsHttpApiGatewayRouter {
  private routes: AwsHttpApiGatewayRoute[] = [
    {
      path: "/auth/access-token",
      methods: [HttpMethod.POST],
    },

    {
      path: "/auth/logout",
      methods: [HttpMethod.POST],
    },

    {
      path: "/auth/refresh-token",
      methods: [HttpMethod.POST],
    },
  ];

  public constructor() {
    super();
  }

  public getRoutes(): AwsHttpApiGatewayRoute[] {
    return this.routes;
  }
}
