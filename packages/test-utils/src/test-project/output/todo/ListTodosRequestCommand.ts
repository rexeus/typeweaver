import definition from "../../definition/todo/queries/ListTodosDefinition";
import { HttpMethod, type IHttpResponse } from "@rexeus/typeweaver-core";
import { RequestCommand } from "../lib/clients";
import { ListTodosResponseValidator } from "./ListTodosResponseValidator";
import type {
  IListTodosRequest,
  IListTodosRequestHeader,
  IListTodosRequestQuery,
  SuccessfulListTodosResponse,
} from "./ListTodosRequest";

import { ListTodosSuccessResponse } from "./ListTodosResponse";

export class ListTodosRequestCommand
  extends RequestCommand
  implements IListTodosRequest
{
  public override readonly method = definition.method as HttpMethod.GET;
  public override readonly path = definition.path;

  public override readonly header: IListTodosRequestHeader;
  declare public readonly param: undefined;
  public override readonly query: IListTodosRequestQuery;
  declare public readonly body: undefined;

  private readonly responseValidator: ListTodosResponseValidator;

  public constructor(input: Omit<IListTodosRequest, "method" | "path">) {
    super();

    this.header = input.header;

    this.query = input.query;

    this.responseValidator = new ListTodosResponseValidator();
  }

  public processResponse(response: IHttpResponse): SuccessfulListTodosResponse {
    const result = this.responseValidator.validate(response);

    if (result instanceof ListTodosSuccessResponse) {
      return result;
    }

    throw result;
  }
}
