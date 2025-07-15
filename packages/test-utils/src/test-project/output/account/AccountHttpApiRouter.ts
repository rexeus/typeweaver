import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type AwsHttpApiGatewayRoute,
  AwsHttpApiGatewayRouter,
} from "../lib/aws-cdk";

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
