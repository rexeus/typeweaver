import {
  type AwsHttpApiGatewayRoute,
  AwsHttpApiGatewayRouter,
  HttpMethod,
} from "@rexeus/typeweaver-core";

export class ProjectHttpApiRouter extends AwsHttpApiGatewayRouter {
  private routes: AwsHttpApiGatewayRoute[] = [
    {
      path: "/projects",
      methods: [HttpMethod.POST, HttpMethod.GET],
    },

    {
      path: "/projects/{projectId}",
      methods: [HttpMethod.GET, HttpMethod.PATCH],
    },

    {
      path: "/projects/{projectId}/status",
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
