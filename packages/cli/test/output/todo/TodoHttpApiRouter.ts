import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type AwsHttpApiGatewayRoute,
  AwsHttpApiGatewayRouter,
} from "../lib/aws-cdk";

export class TodoHttpApiRouter extends AwsHttpApiGatewayRouter {
  private routes: AwsHttpApiGatewayRoute[] = [
    {
      path: "/todos",
      methods: [HttpMethod.POST, HttpMethod.GET],
    },

    {
      path: "/todos/{todoId}",
      methods: [HttpMethod.DELETE, HttpMethod.GET, HttpMethod.PATCH],
    },

    {
      path: "/todos/{todoId}/status",
      methods: [HttpMethod.PUT],
    },
  ];

  public constructor() {
    super();
  }

  public getRoutes(): AwsHttpApiGatewayRoute[] {
    return this.routes;
  }
}
