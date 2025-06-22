import { HttpMethod } from "../definition";

export type AwsHttpApiGatewayRoute = {
  path: string;
  methods: HttpMethod[];
};

export abstract class AwsHttpApiGatewayRouter {
  public abstract getRoutes(): AwsHttpApiGatewayRoute[];
}
