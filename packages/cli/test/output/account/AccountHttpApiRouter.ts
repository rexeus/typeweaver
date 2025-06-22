import {
  type AwsHttpApiGatewayRoute,
  AwsHttpApiGatewayRouter,
  HttpMethod,
} from "@rexeus/typeweaver-core";

export class AccountHttpApiRouter extends AwsHttpApiGatewayRouter {
  private routes: AwsHttpApiGatewayRoute[] = [
    {
      path: "/accounts",
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
