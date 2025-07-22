import definition from "../../definition/todo/queries/ListSubTodosDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { ListSubTodosResponseValidator } from "./ListSubTodosResponseValidator";
import type {
  IListSubTodosRequest,
  IListSubTodosRequestHeader,
  IListSubTodosRequestParam,
  IListSubTodosRequestQuery,
  SuccessfulListSubTodosResponse,
} from "./ListSubTodosRequest";

import { ListSubTodosSuccessResponse } from "./ListSubTodosResponse";

export class ListSubTodosRequestCommand
  extends RequestCommand
  implements IListSubTodosRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IListSubTodosRequestHeader;
  public override readonly param: IListSubTodosRequestParam;
  public override readonly query: IListSubTodosRequestQuery;
  declare public readonly body: undefined;

  private readonly responseValidator: ListSubTodosResponseValidator;

  public constructor(input: Omit<IListSubTodosRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.param = input.param;

    this.query = input.query;

    this.responseValidator = new ListSubTodosResponseValidator();
  }

  public processResponse(
    response: IHttpResponse,
  ): SuccessfulListSubTodosResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof ListSubTodosSuccessResponse) {
      return result;
    }

    throw result;
  }
}
