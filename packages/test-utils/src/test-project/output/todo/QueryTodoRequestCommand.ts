import definition from "../../definition/todo/queries/QueryTodoDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { QueryTodoResponseValidator } from "./QueryTodoResponseValidator";
import type {
  IQueryTodoRequest,
  IQueryTodoRequestHeader,
  IQueryTodoRequestQuery,
  IQueryTodoRequestBody,
  SuccessfulQueryTodoResponse,
} from "./QueryTodoRequest";

import { QueryTodoSuccessResponse } from "./QueryTodoResponse";

export class QueryTodoRequestCommand
  extends RequestCommand
  implements IQueryTodoRequest
{
  public override readonly method = definition.method as HttpMethod.POST;
  public override readonly path = definition.path;

  public override readonly header: IQueryTodoRequestHeader;
  declare public readonly param: undefined;
  public override readonly query: IQueryTodoRequestQuery;
  public override readonly body: IQueryTodoRequestBody;

  private readonly responseValidator: QueryTodoResponseValidator;

  public constructor(input: Omit<IQueryTodoRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.query = input.query;

    this.body = input.body;

    this.responseValidator = new QueryTodoResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulQueryTodoResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof QueryTodoSuccessResponse) {
      return result;
    }

    throw result;
  }
}
