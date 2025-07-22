import { HttpMethod } from "@rexeus/typeweaver-core";
import {
  type AwsHttpApiGatewayRoute,
  AwsHttpApiGatewayRouter,
} from "../lib/aws-cdk";

export class TodoHttpApiRouter extends AwsHttpApiGatewayRouter {
  private routes: AwsHttpApiGatewayRoute[] = [
    {
      path: "/todos/{todoId}/subtodos",
      methods: [HttpMethod.POST, HttpMethod.GET],
    },

    {
      path: "/todos",
      methods: [HttpMethod.POST, HttpMethod.GET],
    },

    {
      path: "/todos/{todoId}/subtodos/{subtodoId}",
      methods: [HttpMethod.DELETE, HttpMethod.PUT],
    },

    {
      path: "/todos/{todoId}",
      methods: [HttpMethod.DELETE, HttpMethod.PATCH, HttpMethod.GET],
    },

    {
      path: "/todos/{todoId}/status",
      methods: [HttpMethod.PUT],
    },

    {
      path: "/todos/{todoId}/subtodos/query",
      methods: [HttpMethod.POST],
    },

    {
      path: "/todos/query",
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
