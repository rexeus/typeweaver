import { HttpMethod } from "@rexeus/typeweaver-core";

export type AwsHttpApiGatewayRoute = {
  path: string;
  methods: HttpMethod[];
};

export abstract class AwsHttpApiGatewayRouter {
  public abstract getRoutes(): AwsHttpApiGatewayRoute[];
}
